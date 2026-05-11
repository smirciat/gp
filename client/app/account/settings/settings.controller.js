'use strict';

class SettingsController {
  errors = {};
  submitted = false;

  constructor(Auth,User) {
    this.Auth = Auth;
    this.user= User.get(res=>{
      
    });
  }

  changePassword(form) {
    this.submitted = true;

    if (form.$valid) {
      this.Auth.changePassword(this.user.oldPassword, this.user.newPassword)
        .then(() => {
          this.message = 'Password successfully changed.';
        })
        .catch(() => {
          form.password.$setValidity('mongoose', false);
          this.errors.other = 'Incorrect password';
          this.message = '';
        });
    }
  }
}

angular.module('goldPointsApp')
  .controller('SettingsController', SettingsController);
