'use strict';

(function() {

  class MainController {

    constructor($http, $scope, socket,Auth,User,$timeout) {
      this.isLoggedIn=Auth.isLoggedIn;
      this.hasRole=Auth.hasRole;
      this.isAdmin=Auth.isAdmin;
      this.user=User.get();
      this.http = $http;
      this.socket = socket;
      this.timeout=$timeout;
      this.query={};
      this.newUser={};
      this.chosenView=null;
      this.queryGo=null;
      this.customers=[];
      this.transaction={status:'Approved',awardRedeem:'redeem',points:0};
      this.showLength=50;
      this.start=0;
      this.end=50;
      this.views=['Manage Users','Approve Points','Add User','Assign Points','Create Member','List By Points'];

    }

    $onInit() {
    }
    
    handle(event,source) {
      if (event.keyCode === 13 && !event.shiftKey) {
          event.preventDefault(); // Stops the newline from being added
          if (source===1) this.createNewUser();
          if (source===2) this.go();
          if (source===3) this.assign();
      }
    }
    
    createNewUser(){
      if (!this.newUser.email||!this.newUser.lastName||!this.newUser.firstName){
        alert('We need some info to create a new user');
        return;
      }
      this.http.post('/api/customers/last').then(res=>{
        this.newUser.userId=res.data.maxInt*1+1;
        this.newUser.userId=this.newUser.userId.toString();
        this.newUser.points=10;
        this.newUser.firstName += ' ';
        if (this.newUser.middleName) this.newUser.middleName += ' ';
        else this.newUser.middleName='';
        this.newUser.fullName=this.newUser.firstName+this.newUser.middleName+this.newUser.lastName;
        this.http.post('/api/customers',this.newUser).then(res=>{
          this.newUser={};
        }).catch(err=>{console.log(err)});
      })
      .catch(err=>{console.log(err)});
    }
    
    assign(){
      this.transaction.points=this.transaction.points*1;
      if (!Number.isInteger(this.transaction.points)||!this.transaction.userId||!this.transaction.account||this.transaction.points<1) {
        alert('Missing Information!');
        return;
      }
      let index=this.customers.map(e=>e.userId).indexOf(this.transaction.userId);
      if (index<0) {
        alert('Can`t find customer');
        return;
      }
      this.transaction.date=new Date();
      this.transaction.lastUpdatedBy=this.user._id;
      this.http.post('/api/transactions',this.transaction).then(res=>{
        if (this.transaction.status==="Approved") {
          if (!this.customers[index].currentPoints) this.customers[index].currentPoints = this.customers[index].points;
          if (this.transaction.awardRedeem==='award') this.customers[index].currentPoints += this.transaction.points;
          else this.customers[index].currentPoints -= this.transaction.points;
          this.customers[index].lastTransaction=res.data._id;
          this.http.patch('/api/customers/'+this.customers[index]._id,this.customers[index])
            .then(res=>{})
            .catch(err=>{console.log(err)});
        }
        this.transaction={status:'Approved',awardRedeem:'redeem',points:0};
      }).catch(err=>{console.log(err)});
    }
    
    select(cust){
      if (this.chosenView==='Manage Users') {
         if (!cust.selected) return;
         this.http.post('/api/transactions/query',{userId:cust.userId}).then(res=>{
           cust.selected=undefined;
           this.customerTransactions=res.data.sort((a,b)=>{
             return a._id-b._id;
           });
           this.customerTransactions.forEach(tran=>{
             if (tran.date) tran.dateString=new Date(tran.date).toLocaleString();
           });
           this.queryGo=null;
           this.showTransactions=true;
         })
          .catch(err=>{console.log(err)});
         return; 
      }
      if (!cust.selected) {
        this.transaction={status:'Approved',awardRedeem:'redeem',points:0};
        return;
      }
      this.timeout(()=>{cust.selected=undefined},5000);
      this.transaction.account=cust.account;
      this.transaction.userId=cust.userId;
    }
    
    backToHub(){
      this.transaction={status:'Approved',awardRedeem:'redeem',points:0};
      this.query={};
      this.newUser={};
      this.chosenView=null;
      this.queryGo=null;
      this.showTransactions=false;
    }
    
    retryQuery(){
      this.queryGo=null;
    }
    
    setView(index){
      this.chosenView=this.views[index];
      this.queryGo=null;
      this.showTransactions=false;
    }
    
    testView(view,otherView){
      if (!this.chosenView) return false;
      let index=this.views.indexOf(view);
      if (index<0) return false;
      otherView=otherView||'';
      return this.chosenView.toLowerCase()===view.toLowerCase()||this.chosenView.toLowerCase()===otherView.toLowerCase();
    }
    
    go(){
      this.http.post('/api/customers/query',{query:this.query})
        .then(res=>{
          this.customers=res.data;
          this.customers.forEach(cust=>{
            if (!cust.currentPoints) cust.currentPoints=cust.points;
          });
          if (this.customers.length===0) this.start=0;
          if (this.customers.length<this.end) this.end=this.customers.length;
        })
        .catch(err=>{console.log(err)});
      this.queryGo='go';
    }
    
    rw(){
      this.start-=this.showLength;
      this.end-=this.showLength;
      if (this.start<=0) this.start=1;
      if (this.end<this.showLength) this.end=this.showLength;
      if (this.customers.length===0) this.start=0;
      if (this.customers.length<this.end) this.end=this.customers.length;
      this.start--;
      this.end--;
    }
    rwStart(){
      this.start=1;
      this.end=25;
      if (this.customers.length===0) this.start=0;
      if (this.customers.length<this.end) this.end=this.customers.length;
      this.start--;
      this.end--;
    }
    ff(){
      this.start+=this.showLength;
      this.end+=this.showLength;
      if (this.start>=this.customers.length) this.start=this.customers.length;
      if (this.send>=this.customers.length) this.end=this.customers.length;
      if (this.customers.length===0) this.start=0;
      if (this.customers.length<this.end) this.end=this.customers.length;
      this.start--;
      this.end--;
    }
    ffEnd(){
      this.start=this.customers.length-this.showLength;
      this.end=this.customers.length;
      if (this.customers.length===0) this.start=0;
      this.start--;
      this.end--;
    }
  }

  angular.module('goldPointsApp')
    .component('main', {
      templateUrl: 'app/main/main.html',
      controller: MainController,
      controllerAs: 'main'
    });
})();
