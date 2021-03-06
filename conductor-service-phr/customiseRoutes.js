/*

 ----------------------------------------------------------------------------
 | conductor-service-phr: Ripple PHR Conductor MicroService                 |
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

  19 February 2018

*/

var remap = require('./remap_routes');
//var util = require('util');

function sendError(message, res) {
  res.set('content-length', message.length);
  res.status(400).send(message);
}

module.exports = function(routes, config) {

  // add afterRouter to handle redirection after Authentication by Auth0 / Gov.Verify
  //  signalled by the response containing the reserved property: qewd_redirect
  //  such responses must also define the path and name of the cookie that will hold the JWT

  for (var index = 0; index < routes.length; index++) {

    routes[index].beforeRouter = [
      (req, res, next) => {

        console.log('Incoming request: ' + req.method + ': ' + req.originalUrl);
        console.log('Incoming request: req.url = ' + req.url);
        console.log('Incoming request - headers = ' + JSON.stringify(req.headers, null, 2));


        //console.log(util.inspect(req));

        // CSRF Protection  (can't be done for OpenId Connect's request)
       
        if (req.url.indexOf('/auth/token?code=') === -1) {

          if (!req.headers) {
            return sendError('Invalid request: headers missing', res);
          }
          if (!req.headers['x-requested-with']) {
            return sendError('Invalid request: x-requested-with header missing', res);
          }
          if (req.headers['x-requested-with'] !== 'XMLHttpRequest') {
            return sendError('Invalid request: x-requested-with header invalid', res);
          }
        }

        // end CSRF Protection

        // original Ripple sends the QEWD Session token as a cookie header
        // copy this into a Bearer authorization header

        if (!req.headers.authorization && req.headers.cookie) {
          if (req.headers.cookie.indexOf('JSESSIONID=') !== -1) {
            var token = req.headers.cookie.split('JSESSIONID=')[1];
            token = token.split(';')[0];
            req.headers.authorization = 'Bearer ' + token;
            delete req.headers.cookie;
          }
        }

        if (remap && remap[req.originalUrl] && remap[req.originalUrl].to && typeof remap[req.originalUrl].to === 'function') {
          req.redirectedFrom = req.originalUrl;
          req.originalUrl = remap[req.originalUrl].to(config);
          console.log('*** beforeRouter - req.redirectedFrom = ' + req.redirectedFrom);
        }
        next();
      }
    ];

    routes[index].afterRouter = [
      (req, res, next) => {

        console.log('*** afterRouter - req.redirectedFrom = ' + req.redirectedFrom + '; ' + req.originalUrl);
        // a response message coming back from the worker will be saved in res.locals.message 
        //by the worker handler code, so
        //console.log('** res.locals.message = ' + JSON.stringify(res.locals.message));
        var messageObj = res.locals.message;
        if (messageObj.qewd_redirect) {
          if (messageObj.cookieName) {
            var value = messageObj.cookieValue || messageObj.token;
            var options = {path: messageObj.cookiePath};
            if (messageObj.cookieDelete) {
              res.clearCookie(messageObj.cookieName, options);
            }
            else {
              res.cookie(messageObj.cookieName, value, options);
            }
          }
          if (messageObj.cors) {
            console.log('** adding CORS headers');
            res.header('Access-Control-Allow-Credentials', 'true');
            res.header('Access-Control-Allow-Headers', 'DNT,X-CustomHeader,Keep-Alive,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Authorization');
            res.header('Access-Control-Allow-Methods', 'GET, PUT, DELETE, POST, OPTIONS');
            res.header('Access-Control-Allow-Origin', '*');
          }
          console.log('redirecting browser to ' + messageObj.qewd_redirect);
          res.redirect(messageObj.qewd_redirect);
        }
        else {

          // send message as usual

          if (messageObj.error) {
            var code = 400;
            var status = messageObj.status;
            if (status && status.code) code = status.code;
            console.log('afterRouter for ' + req.originalUrl + ' sending an error response: ' + JSON.stringify(messageObj));
            res.set('content-length', messageObj.length);
            res.status(code).send(messageObj);
          }
          else {
            if (remap && remap[req.redirectedFrom] && remap[req.redirectedFrom].onResponse && typeof remap[req.redirectedFrom].onResponse === 'function') {
              console.log('remapping response for ' + req.redirectedFrom);
              messageObj = remap[req.redirectedFrom].onResponse(messageObj);
              console.log('new response: ' + JSON.stringify(messageObj));
            }
            console.log('afterRouter for ' + req.originalUrl + ' sending its response');
            res.send(messageObj);
          }
        }
      }
    ];
  }
  
  return routes;

};
