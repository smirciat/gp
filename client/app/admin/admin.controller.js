'use strict';

(function() {

  class AdminController {
    constructor(User,Auth,appConfig,$http) {
      // Use the User $resource to fetch all users
      this.users = User.company((res)=>{
        this.users=res;
        this.filteredUsers=JSON.parse(JSON.stringify(this.users));
      });
      //$http.get('/api/users/company',{guests:true}).then(res=>{});
      this.Auth=Auth;
      this.roles=appConfig.userRoles;
      this.http=$http;
      this.roles.unshift('All');
      this.role={};
      this.role.selected = "";
      this.sort={};
      this.sort.selected = "name";
      this.sortBy = ["_id","email","name"];
      this.filteredUsers=[];
    }
    
    newSort() {
      this.filteredUsers=this.filteredUsers.sort((a,b)=>{
        if (this.sort.selected==="_id") return a._id-b._id;
        else {
          if (!a[this.sort.selected]) a[this.sort.selected]="";
          if (!b[this.sort.selected]) b[this.sort.selected]="";
          return a[this.sort.selected].localeCompare( b[this.sort.selected]);
        }
      });
    }
    
    filterResults(){
      if (!this.role.selected||this.role.selected==="All") this.filteredUsers=JSON.parse(JSON.stringify(this.users));
      else {
        this.filteredUsers=this.users.filter(user=>user.role===this.role.selected);
      }
      this.newSort();
    }
    
    reset(user){
      this.http.post('/api/users/reset',user).then(res=>{alert('Password Reset to temporary')}).catch(err=>{console.log(err)});
    }

    delete(user) {
      if (confirm('Are you sure you want to delete this user named ' + user.name + '?')){
        user.$remove();
        this.users.splice(this.users.indexOf(user), 1);
        this.filteredUsers.splice(this.filteredUsers.indexOf(user), 1);
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
