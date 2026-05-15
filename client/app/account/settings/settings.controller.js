'use strict';

class SettingsController {
  errors = {};
  submitted = false;

  constructor(Auth,User) {
    this.Auth = Auth;
    this.user= User.get(res=>{
    this.User=User;
    });
  }
  
  updateName(){
    if (!this.user||!this.user.name) alert('No user to Update Name For!');
    this.user.name=prompt('Enter the new full name to replace "'+ this.user.name +'" the way you would like it to appear');
    this.User.update(this.user);
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
