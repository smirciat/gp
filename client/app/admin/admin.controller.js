'use strict';

(function() {

  class AdminController {
    constructor(User,Auth,appConfig,$http) {
      // Use the User $resource to fetch all users
      this.users = User.query((res)=>{
        this.users=res.sort((a,b)=>{
          return a.name.localeCompare(b.name);
        });
      });
      this.Auth=Auth;
      this.roles=appConfig.userRoles;
      this.http=$http;
    }
    
    reset(user){
      this.http.patch('/api/users/reset',user).then(res=>{alert('Password Reset to Default')}).catch(err=>{console.log(err)});
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
      if (index===0) alert('Can`t get any lower than this!');
      if (index>0) {
        user.role=this.roles[index-1];
        this.Auth.adminChangeRole(user._id,user.role,res=>{
          alert('User ' + user.name + ' role changed to ' + user.role);
        });
      }
    }
    
    promote(user){
      let index=this.roles.indexOf(user.role);
      if (index===this.roles.length-1) alert('Can`t get any higher than this!');
      if (index>-1&&index<(this.roles.length-1)) {
        user.role=this.roles[index+1];
        this.Auth.adminChangeRole(user._id,user.role,res=>{
          alert('User ' + user.name + ' role changed to ' + user.role);
        });
      }
    }
  }

  angular.module('goldPointsApp.admin')
    .controller('AdminController', AdminController);
})();
