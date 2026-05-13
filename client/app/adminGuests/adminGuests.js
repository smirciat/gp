'use strict';

angular.module('goldPointsApp')
  .config(function ($stateProvider) {
    $stateProvider
      .state('adminGuests', {
        url: '/adminGuests',
        template: '<admin-guests></admin-guests>'
      });
  });
