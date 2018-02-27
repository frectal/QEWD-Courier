/*

 ----------------------------------------------------------------------------
 | qewd: Quick and Easy Web Development                                     |
 |                                                                          |
 | Copyright (c) 2017 M/Gateway Developments Ltd,                           |
 | Redhill, Surrey UK.                                                      |
 | All rights reserved.=|
 |                                                                          |
 | http://www.mgateway.com                                                  |
 | Email: rtweed@mgateway.com                                               |
 |                                                                          |
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

  3 November 2017

*/

var buildJsonFile = require('./buildJsonFile');
var buildFHIRToOpenEHR = require('./buildFHIRToOpenEHR');

module.exports = function(fhirResourceName, jumperPath) {

  var text = {
    resourceType: fhirResourceName,
    identifier: [
      {
        system: "http://ripple.foundation/sourceId",
        value: "{{uid}}"
      }
    ],
    //onset: "=> getDate(start_time)",
    //recordedDate: "=> getDate(start_time)",
    onset: "=> rippleDateTime(start_time, false)",
    recordedDate: "=> rippleDateTime(start_time, false)",
    recorder: {
      //reference: "Practitioner/{{composer.code}}",
      reference: "=> fhirReference(composer.code, 'Practitioner', false)",
      display: "{{composer.value}}"
    },
    patient: {
      //reference: "Patient/{{patientId}}",
      reference: "=> fhirReference(patientId, 'Patient', false)",
      display: "{{patientName}}"
    }
  };

  buildJsonFile(text, jumperPath, 'openEHR_to_FHIR.json');
  buildFHIRToOpenEHR(jumperPath);
};