'use strict';

class NavbarController {
  //start-non-standard
  menu = [{
    'title': 'Home',
    'state': 'main'
  }];

  isCollapsed = true;
  //end-non-standard

  constructor(Auth) {
    this.isLoggedIn = Auth.isLoggedIn;
    this.isAdmin = Auth.isAdmin;
    this.hasRole=Auth.hasRole;
    this.getCurrentUser = Auth.getCurrentUser;
  }

}

angular.module('goldPointsApp')
  .controller('NavbarController', NavbarController);
