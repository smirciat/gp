'use strict';

class LoginController {
  constructor(Auth, $state, $http) {
    this.user = {};
    this.errors = {};
    this.submitted = false;
    this.guestUiRetired = false;
    this.guestPublicUrl = 'https://public.beringair.com/public/gold-points';

    this.Auth = Auth;
    this.$state = $state;
    this.$http = $http;
  }

  $onInit() {
    this.$http.get('/api/meta/site').then(res => {
      if (res.data) {
        this.guestUiRetired = !!res.data.guestUiRetired;
        if (res.data.guestPublicUrl) {
          this.guestPublicUrl = res.data.guestPublicUrl;
        }
      }
    }).catch(() => {});
  }

  login(form) {
    this.submitted = true;

    if (form.$valid) {
      this.Auth.login({
          email: this.user.email,
          password: this.user.password
        })
        .then(() => {
          // Logged in, redirect to home
          this.$state.go('main');
        })
        .catch(err => {
          this.errors.other = err.message;
        });
    }
  }
}

LoginController.$inject = ['Auth', '$state', '$http'];

angular.module('goldPointsApp')
  .controller('LoginController', LoginController);
