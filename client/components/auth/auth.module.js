'use strict';

angular.module('goldPointsApp.auth', ['goldPointsApp.constants', 'goldPointsApp.util', 'ngCookies',
    'ui.router'
  ])
  .config(function($httpProvider) {
    $httpProvider.interceptors.push('authInterceptor');
  });
