'use strict';

(function() {

  class MainController {

    constructor($http, $scope, socket,Auth,User,$timeout) {
      this.isLoggedIn=Auth.isLoggedIn;
      this.hasRole=Auth.hasRole;
      this.isAdmin=Auth.isAdmin;
      this.User=User;
      this.http = $http;
      this.socket = socket;
      this.timeout=$timeout;
      this.query={};
      this.gpTransfer={};
      this.newMember={gpType:'Primary'};
      this.chosenView=null;
      this.queryGo=null;
      this.customers=[];
      this.transaction={status:'Approved',awardRedeem:'redeem',points:0};
      this.showLength=50;
      this.start=0;
      this.end=50;
      this.views=['Manage Members','Approve Points','Add User','Assign Points','Create Member','List By Points'];
      this.welcomeEmail="Congratulations! <br> You have just created a Bering Air Gold Points Membership!<br>";
      this.welcomeEmail+="Please head over to beringair.net to complete your sign up process. Once you have loaded beringair.net on an internet browser, click the 'Register' button.  Make sure you use the same email address there that you used when you signed up for the Gold Points Membership.  You can use any password you like.  Once registered, you will be able to see any future Gold Points transactions that are attached to this account.  Please let us know if you have any questions or difficulties.  Thanks for flying with Bering Air!";
    }

    $onInit() {
      this.user=this.User.get(res=>{
        if (res.role==="guest"&&res.email){
          //setup public customers
          this.query={email:res.email};
          this.queryGo='go';
          this.go();
        }
      });
    }
    
    handle(event,source) {
      if (event.keyCode === 13 && !event.shiftKey) {
          event.preventDefault(); // Stops the newline from being added
          if (source===1) this.createNewMember();
          if (source===2) this.go();
          if (source===3) this.assign();
      }
    }
    
    createNewMember(){
      if (!this.newMember.email||!this.newMember.lastName||!this.newMember.firstName){
        alert('We need some info to create a new user');
        return;
      }
      this.http.post('/api/customers/last').then(res=>{
        this.newMember.userId=res.data.maxInt*1+1;
        this.newMember.userId=this.newMember.userId.toString();
        this.newMember.points=10;
        this.newMember.firstName += ' ';
        if (this.newMember.middleName) this.newMember.middleName += ' ';
        else this.newMember.middleName='';
        this.newMember.fullName=this.newMember.firstName+this.newMember.middleName+this.newMember.lastName;
        if (this.newMember.gpType==='Associate'&&!this.newMember.primaryUserId){
          alert('You must have a Primary Member`s Id entered for an Associate account');
          return;
        }
        let nm=JSON.parse(JSON.stringify(this.newMember));
        this.http.post('/api/customers',this.newMember).then(res=>{
          //send a welcome email
          if (this.newMember.email) this.http.post('/api/things/email',{to:this.newMember.email,html:this.welcomeEmail}).then(res=>{}).catch(err=>{console.log(err)});
          //set up initial transaction for new Member
          let transaction=res.data;
          delete transaction._id;
          transaction.awardRedeem='award';
          transaction.description="New GP Member Account Sign Up";
          transaction.date=new Date();
          transaction.dateFlown=new Date().toLocaleDateString();
          transaction.status="Approved";
          this.http.post('/api/transactions',transaction).then(res=>{}).catch(err=>{console.log(err)});
          if (nm==='Associate'){
            this.http.get('/api/customers/one',{userId:nm.primaryUserId}).then(res=>{
              if (!res.data||!res.data.userId) return;
              let accounts=res.data.associatedAccounts||[];
              if (!Array.isArray(accounts)) return;
              if (accounts.indexOf(nm.userId)>-1) return;
              accounts.push(nm.userId);
              this.http.patch('/api/customers/'+res.data._id,{associatedAccounts:accounts}).then(res=>{}).catch(err=>{console.log(err)});
             })
             .catch(err=>{console.log(err)});
          }
          this.newMember={gpType:"Primary"};
        }).catch(err=>{console.log(err)});
      })
      .catch(err=>{console.log(err)});
    }
    
    assign(transaction){
      transaction=transaction||this.transaction;
      transaction.points=transaction.points*1;
      if (!Number.isInteger(transaction.points)||!transaction.userId||transaction.points<1) {
        alert('Missing Information!');
        return;
      }
      let index=this.customers.map(e=>e.userId).indexOf(transaction.userId);
      if (index<0) {
        alert('Can`t find customer');
        return;
      }
      transaction.date=new Date();
      if (!transaction.dateFlown) transaction.dateFlown=new Date().toLocaleDateString();
      transaction.lastUpdatedBy=this.user._id;
      this.http.post('/api/transactions',transaction).then(res=>{
        if (transaction.status==="Approved") {
          if (!this.customers[index].currentPoints) this.customers[index].currentPoints = this.customers[index].points;
          if (transaction.awardRedeem==='award') this.customers[index].currentPoints += transaction.points;
          else this.customers[index].currentPoints -= transaction.points;
          this.customers[index].lastTransaction=res.data._id;
          this.http.patch('/api/customers/'+this.customers[index]._id,this.customers[index])
            .then(res=>{})
            .catch(err=>{console.log(err)});
        }
        this.transaction={status:'Approved',awardRedeem:'redeem',points:0};
      }).catch(err=>{console.log(err)});
    }
    
    select(cust){
      if (this.chosenView==='Manage Members') {
         if (!cust.selected) return;
         this.customer=JSON.parse(JSON.stringify(cust));
         this.associated=[];
         if (this.customer.associatedAccounts) {
           this.customer.associatedAccounts.forEach(cust=>{
             this.http.get('/api/customers/one',{userId:cust}).then(res=>{
               this.associated.push(res.data);
             })
             .catch(err=>{console.log(err)});
           });
           this.timeout(()=>{console.log(this.associated)},2000);
         }
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
    
    deleteTransaction(tran,index){
      if (confirm('Are you sure you want to delete this transaction?')){
        this.http.delete('/api/transactions/'+tran._id).then(res=>{
          this.customerTransactions.splice(index,1);
          let i=this.customers.map(e=>e.userId).indexOf(tran.userId);
          if (i>-1){
            if (tran.awardRedeem==="award") this.customers[i].currentPoints-=tran.points;
            else this.customers[i].currentPoints+=tran.points;
            this.http.patch('/api/customers/'+this.customers[i]._id,{currentPoints:this.customers[i].currentPoints}).then(res=>{}).catch(err=>{console.log(err)});
          }
        }).catch(err=>{console.log(err)});
      }
    }
    
    backToHub(){
      this.transaction={status:'Approved',awardRedeem:'redeem',points:0};
      this.query={};
      this.newMember={gpType:'Primary'};
      this.chosenView=null;
      this.queryGo=null;
      this.showTransactions=false;
    }
    
    retryQuery(){
      this.queryGo=null;
    }
    
    setView(index){
      if (this.user.role==='guest'&&index>0) {
        alert('This Selection is Restricted to Employee Users.  Contact Site Admin if You Believe This is in Error.');
        return;
      }
      this.queryGo=null;
      if (this.user.role==="guest") {
        this.queryGo=true;
        this.go();
      }
      this.chosenView=this.views[index];
      this.showTransactions=false;
    }
    
    testView(view,otherView){
      if (!this.chosenView) return false;
      let index=this.views.indexOf(view);
      if (index<0) return false;
      otherView=otherView||'';
      return this.chosenView.toLowerCase()===view.toLowerCase()||this.chosenView.toLowerCase()===otherView.toLowerCase();
    }
    
    updateCustomer(){
      if (!this.customer) return;
      if (this.customer.phone) this.customer.phone=this.customer.phone.replace(/\D/g, "");
      let obj={fullName:this.customer.fullName,email:this.customer.email,phone:this.customer.phone,dob:this.customer.dob,
          address:this.customer.address,city:this.customer.city,state:this.customer.state,zip:this.customer.zip};
      this.http.patch('/api/customers/'+this.customer._id,obj).then(res=>{
        let index=this.customers.map(e=>e.userId).indexOf(this.customer.userId);
        if (index>-1) {
          if (!this.customers[index].email&&this.customer.email){
            //new email entered, send them one!
            this.http.post('/api/things/email',{to:this.customer.email,html:this.welcomeEmail}).then(res=>{}).catch(err=>{console.log(err)});
          }
          this.customers[index]=res.data;
        }
        alert('Successfully Updated Member Details!');
      }).catch(err=>{
        console.log(err);
        alert('Try Again!');
      });
    }
    
    go(){
      this.http.post('/api/customers/query',{query:this.query})
        .then(res=>{
          if (this.user.role==='guest'&&res.data.length>0) {
            let found=false;
            res.data.forEach(cust=>{
              if (cust.gpType==="Primary"){
                cust.selected=true;
                this.select(cust);
                found=true;
              }
            });
            if (!found) {
              res.data[0].selected=true;
              this.select(res.data[0]);
            }
          }
          this.customers=res.data.sort((a,b)=>{return b.points-a.points});
          this.customers.forEach(cust=>{
            if (!cust.currentPoints) cust.currentPoints=cust.points;
            if (!cust.gpType) cust.gpType='Primary';
          });
          this.start=0;
          if (this.customers.length===0) this.start=-1;
          this.end=this.customers.length-1;
          this.queryGo='go';
        })
        .catch(err=>{console.log(err)});
    }
    
    transfer(){
      if (this.gpTransfer.points>this.customer.currentPoints) {
        alert('Try again with an available amount of points');
        return;
      }
      this.http.post('/api/customers/one',{userId:this.gpTransfer.userId}).then(res=>{
        if (!res.data||!res.data.userId) {
          alert('Didn`t find that User ID');
          return;
        }
        if (confirm('Confirm transferring ' + this.gpTransfer.points + ' to ' + res.data.fullName + ' with user ID of ' + this.gpTransfer.userId)) {
          this.customer.currentPoints-=this.gpTransfer.points;
          let i=this.customers.map(e=>e.userId).indexOf(res.data.userId);
          if (i<0) this.customers.push(res.data);
          let transaction={userId:this.customer.userId,awardRedeem:'redeem',points:this.gpTransfer.points,
              description:'GP Transfer from '+ this.customer.userId +' to ' + res.data.fullName + ' with user ID of ' + this.gpTransfer.userId,
              status:'Approved'
          };
          this.assign(transaction);
          let t=JSON.parse(JSON.stringify(transaction));
          t.awardRedeem='award';
          t.userId=res.data.userId;
          this.assign(t);
          this.gpTransfer={};
        }
      }).catch(err=>{console.log(err)});
    }
  }

  angular.module('goldPointsApp')
    .component('main', {
      templateUrl: 'app/main/main.html',
      controller: MainController,
      controllerAs: 'main'
    });
})();
