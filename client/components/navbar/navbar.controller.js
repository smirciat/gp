'use strict';

class NavbarController {
  //start-non-standard
  menu = [{
    'title': 'Home',
    'state': 'main'
  }];

  isCollapsed = true;
  //end-non-standard

  constructor(Auth, $http) {
    this.isLoggedIn = Auth.isLoggedIn;
    this.isAdmin = Auth.isAdmin;
    this.hasRole=Auth.hasRole;
    this.getCurrentUser = Auth.getCurrentUser;
    this.staffUiRetired = false;
    $http.get('/api/meta/site').then(res => {
      if (res.data) {
        this.staffUiRetired = !!res.data.staffUiRetired;
      }
    }).catch(() => {});
  }

}

angular.module('goldPointsApp')
  .controller('NavbarController', NavbarController);
