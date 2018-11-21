/*

 ----------------------------------------------------------------------------
 | ripple-cdr-openehr: Ripple MicroServices for OpenEHR                     |
 |                                                                          |
 | Copyright (c) 2018 Ripple Foundation Community Interest Company          |
 | All rights reserved.                                                     |
 |                                                                          |
 | http://rippleosi.org                                                     |
 | Email: code.custodian@rippleosi.org                                      |
 |                                                                          |
 | Author: Rob Tweed, M/Gateway Developments Ltd                            |
 |                                                                          |
 | Licensed under the Apache License, Version 2.0 (the "License");          |
 | you may not use this file except in compliance with the License.         |
 | You may obtain a copy of the License at                                  |
 |                                                                          |
 |     http://www.apache.org/licenses/LICENSE-2.0                           |
 |                                                                          |
 | Unless required by applicable law or agreed to in writing, software      |
 | distributed under the License is distributed on an "AS IS" BASIS,        |
 | WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. |
 | See the License for the specific language governing permissions and      |
 |  limitations under the License.                                          |
 ----------------------------------------------------------------------------

  21 June 2018

*/

var loadAQLFile = require('../loadAQLFile');
var openEHR = require('../openEHR');
var template = require('qewd-template');
var getHeadingByJumper;

try {
  getHeadingByJumper = require('../../ripple-openehr-jumper/lib/getHeadingFromOpenEHRServer');
}
catch(err) {
  console.log('!*!*!*!*! Error - unable to load ripple-openehr-jumper/lib/getHeadingFromOpenEHRServer');
}

var aql = {};

function getEhrId(nhsNo, host) {
  return this.db.use('RippleNHSNoMap', ['byNHSNo', nhsNo, host]).value;
}

function getTransformedAQL(host, nhsNo, aql) {
  var subs = {
    ehrId: getEhrId.call(this, nhsNo, host)
  };

  //console.log('\ngetTransformedAQL: subs = ' + JSON.stringify(subs) + '; aql: ' + aql);

  return {
    aql: template.replace(aql, subs)
  };
}

function getHeading(nhsNo, heading, host, session, openEHRSession, callback) {
  console.log('** getHeadingFromOpenEHRServer: ');
  console.log('host = ' + host);
  console.log('heading = ' + heading);
  console.log('userDefined: ' + JSON.stringify(this.userDefined.headings[heading]));
  if (getHeadingByJumper) console.log('getHeadingByJumper: true');
  if (this.userDefined.headings[heading].template) {
    console.log('this.userDefined.headings[heading].template: true');
    if (this.userDefined.headings[heading].template.name) console.log('this.userDefined.headings[heading].template.name: ' + this.userDefined.headings[heading].template.name);
  }

  if (getHeadingByJumper && this.userDefined.headings[heading] && this.userDefined.headings[heading].template && this.userDefined.headings[heading].template.name) {
    // use Jumper instead to get the heading

    console.log('** using Jumper to fetch this heading');

    var params = {
      patientId: nhsNo,
      heading: heading,
      host: host,
      qewdSession: session,
      openEHR: openEHR,
      openEHRSession: openEHRSession,
      ehrId: getEhrId.call(this, nhsNo, host)
    };

    getHeadingByJumper.call(this, params, callback);
    return;
  }

  if (!aql[heading]) {
    aql[heading] = loadAQLFile(heading);
    console.log('heading = ' + heading + ': aql = ' + JSON.stringify(aql));
  }

  var params = {
    host: host,
    heading: heading, // for debugging only
    callback: callback,
    url: '/rest/v1/query',
    method: 'GET',
    session: openEHRSession.id,
    logResponse: false
  };

  params.queryString = getTransformedAQL.call(this, host, nhsNo, aql[heading]);

  params.processBody = function(body) {
    console.log(new Date().getTime() + ' response received from ' + host + ': ' + heading);
    //console.log('**** processBody for host ' + host + ': body = ' + body);
    var results = [];
    if (!body) body = {
      resultSet: []
    };
    if (typeof body.resultSet === 'undefined') {
      body = {
        resultSet: []
      };
    }

    var headingCache = session.data.$('headings');
    var byPatientIdCache = headingCache.$(['byPatientId', nhsNo, heading]);
    var bySourceIdCache = headingCache.$(['bySourceId']);
    
    body.resultSet.forEach(function(result) {
      if (heading === 'counts') {
        result.uid = result.ehrId + '::';
        result.dateCreated = Date.now();
      }
      if (result.uid) {
        var sourceId = host + '-' + result.uid.split('::')[0];
        var dateCreated = result.date_created || result.dateCreated;
        var date = new Date(dateCreated).getTime();
        var record = {
          heading: heading,
          host: host,
          patientId: nhsNo,
          date: date,
          data: result,
          uid: result.uid
        };
        bySourceIdCache.$(sourceId).setDocument(record);
        byPatientIdCache.$(['byDate', date, sourceId]).value = '';
        byPatientIdCache.$(['byHost', host, sourceId]).value = '';
      }
    });
    console.log(new Date().getTime() + ' Finished processing response from ' + host + ': ' + heading);
  };

  openEHR.request(params);
}

module.exports = getHeading;
