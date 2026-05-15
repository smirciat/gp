'use strict';

(function() {

  function UserResource($resource) {
    return $resource('/api/users/:id/:controller', {
      id: '@_id'
    }, {
      changePassword: {
        method: 'PUT',
        params: {
          controller: 'password'
        }
      },
      adminChangeRole: {
        method: 'PUT',
        params: {
          controller:'changerole'
        }
      },
      get: {
        method: 'GET',
        params: {
          id: 'me'
        }
      },
      update:{
        method: 'PATCH'
      },
      company:{
        method: 'GET',
        isArray:true,
        params: {
          id: 'company'
        }
      }
    });
  }

  angular.module('goldPointsApp.auth')
    .factory('User', UserResource);
})();
