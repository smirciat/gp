'use strict';

(function() {

  class AdminController {
    constructor(User,Auth,appConfig,$timeout) {
      // Use the User $resource to fetch all users
      this.users = User.query();
      $timeout(()=>{
        this.users=this.users.sort((a,b)=>{
          return a.name.localeCompare(b.name);
        });
      },500);
      this.Auth=Auth;
      this.roles=appConfig.userRoles;
      this.timeout=$timeout;
    }
    
    $onInit(){
      
    }

    delete(user) {
      if (confirm('Are you sure you want to delete this user named ' + user.name + '?')){
        user.$remove();
        this.users.splice(this.users.indexOf(user), 1);
      }
      else alert('Action Canceled');
    }
    
    demote(user){
      let index=this.roles.indexOf(user.role);
      if (index>-1&&index>0) {
        user.role=this.roles[index-1];
        this.Auth.adminChangeRole(user._id,user.role);
      }
    }
    
    promote(user){
      let index=this.roles.indexOf(user.role);
      if (index>-1&&index<(this.roles.length-1)) {
        user.role=this.roles[index+1];
        this.Auth.adminChangeRole(user._id,user.role);
      }
    }
  }

  angular.module('goldPointsApp.admin')
    .controller('AdminController', AdminController);
})();
