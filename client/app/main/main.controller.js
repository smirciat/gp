'use strict';

(function() {

  class MainController {

    constructor($http, $scope, socket,Auth,User,$timeout,toaster) {
      this.isLoggedIn=Auth.isLoggedIn;
      this.hasRole=Auth.hasRole;
      this.isAdmin=Auth.isAdmin;
      this.User=User;
      this.http = $http;
      this.socket = socket;
      this.timeout=$timeout;
      this.toaster=toaster;
      this.query={};
      this.gpTransfer={};
      this.newMember={gpType:'Primary',associates:[{},{},{},{}]};
      this.existing={associates:['','','','']};
      this.chosenView=null;
      this.queryGo=null;
      this.customers=[];
      this.transaction={status:'Approved',awardRedeem:'award',points:0};
      this.showLength=50;
      this.start=0;
      this.end=50;
      this.views=['Manage Members','Approve Points','Add User','Assign Points','Create Member','List By Points','All Transactions'];
      this.welcomeEmail="Congratulations! <br><br>You have just created a Bering Air Gold Points Membership!<br><br>";
      this.welcomeEmail+="Please head over to gp.beringair.com to complete your sign in and access your account data. Your username is the same email address there that you used when you signed up for the Gold Points Membership.  Your temporary password is shown at the bottom of this email.  Once signed in, you will be able to see any future Gold Points transactions that are attached to this account.  Please let us know if you have any questions or difficulties. <br><br>Thank you for flying with Bering Air!";
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
      //this.http.post('/api/things/ssm').then(res=>{console.log(res)}).catch(err=>{console.log(err)})
      this.http.post('/api/things/getManifest',{date:'5/11/2026',flightNum:'850'}).then(res=>{
        console.log(res.data);
      }).catch(err=>{console.log(err)});
    }
    
    handle(event,source) {
      if (event.keyCode === 13 && !event.shiftKey) {
          event.preventDefault(); // Stops the newline from being added
          if (source===1) this.createNewMember();
          if (source===2) this.go();
          if (source===3) this.assign();
          if (source===4) this.processExisting();
      }
    }
    
    processExisting(swap){
      let associates=JSON.parse(JSON.stringify(this.existing.associates));
      //up to 5 userId s find each one if the exist and update: primaryUserId for associate, associate array for primary
      if (!this.existing.primary||(!this.existing.associates[0]&&!this.existing.associates[1]&&!this.existing.associates[2]&&!this.existing.associates[3])) return;
      //if not swapping within an existing group, don't add current primary members as associates
      let fail=false;
      if (!swap){
        this.existing.associates.forEach(ass=>{
          if (ass.gpType==="Primary") fail=true;
        });
        if (fail){
          this.toaster.error('Error','One of those associate User ID`s may belong to a primary member');
          return;
        }
      }
      //primary
      this.http.post('/api/customers/one', { userId: this.existing.primary }).then(res => {
        if (!res.data || !res.data.userId) return;
        let primary = JSON.parse(JSON.stringify(res.data));
        primary.associatedAccounts = primary.associatedAccounts || [];
        associates.forEach(ass => {
          primary.associatedAccounts.push(ass);
          // remove duplicates and blanks
          primary.associatedAccounts = [...new Set(primary.associatedAccounts.filter(str => str !== ""))];
        });
        console.log(primary.associatedAccounts);
        let fail = false;
        // create array of promises
        let promises = primary.associatedAccounts.map(ass => {
          return this.http.post('/api/customers/one', { userId: ass })
          .then(r => {
              return {ass: ass,data: r.data};
          })
          .catch(err=>{
            console.log(err);
            this.toaster.error('Error','Associate User ID ' + ass + ' is not Found!');
            return {error:true};
          });
        });
        return Promise.all(promises).then(results => {
          let assObjects = [];
          let names = [];
          results.forEach(result => {
              if (!result) return;
              if (result.error) {
                fail=true;
                return;
              }
              assObjects.push(result.data);
              names.push('"' + result.data.fullName + '"');
          });
          let str = names.join(', & ');
          if (!fail) {
            this.finalizeExisting(primary,associates,assObjects,str);
          }
        })
        .catch(err=>{console.log(err)});
      })
      .catch(err => {
        console.log(err);
        this.toaster.error('Error','Primary User ID is not Found!');
      });
    }
    
    finalizeExisting(primary,associates,assObjects,str){
      
        //confirm info prior to updating
        if (confirm('DOUBLE CHECK NAMES! Please Confirm assigning "' + primary.fullName + '" as Primary Member with ' + str + '" as Associate Members')) {
          //update the customer
          this.http.patch('/api/customers/'+primary._id,{gpType:"Primary",associatedAccounts:primary.associatedAccounts,primaryUserId:''}).then(res=>{
            this.existing={associates:['','','','']};
            //find each associate and update them
            assObjects.forEach(obj=>{
              if (!obj||!obj.userId) return;
              this.http.patch('/api/customers/'+obj._id,{gpType:"Associate",primaryUserId:primary.userId,associatedAccounts:[]}).then(res=>{
                
              }).catch(err=>{
                this.toaster.error('Error','Failed to Update Associate Customer #' + obj.userId);
                console.log(err);
              });
              
            });
          }).catch(err=>{
            console.log(err);
            this.toaster.error('Error','Failed to Update Primary Customer #' + primary.userId);
          });
        }
    }
    
    changePrimary(){
      if (confirm('Confirm you want to change your Primary Member to ' +this.selectedAssociate.fullName+ ' and change your status to Associate')) {
        this.existing={primary:this.selectedAssociate.userId};
        this.existing.associates=[this.customer.userId];
        this.associated.forEach(ass=>{
          if (ass.userId!==this.selectedAssociate.userId) this.existing.associates.push(ass.userId);
        });
        this.selectedAssociate=undefined;
        this.processExisting(true);
        this.timeout(()=>{
          if (this.hasRole('user')) this.undoST();
          else this.backToHub();
        },1000);
      }
    }
    
    createNewMember(){
      if (!this.newMember.email||!this.newMember.lastName||!this.newMember.firstName){
        this.toaster.error('Error','We need some info to create a new user');
        return;
      }
      this.http.post('/api/customers/last').then(res=>{
        this.newMember.userId=res.data.maxInt*1+1;
        this.newMember.userId=this.newMember.userId.toString();
        this.newMember.account=Number(new Date().toISOString().split('T')[0].replace(/-/g, ''))+this.newMember.userId;
        this.newMember.points=10;
        this.newMember.currentPoints=10;
        this.newMember.firstName += ' ';
        if (this.newMember.middleName) this.newMember.middleName += ' ';
        else this.newMember.middleName='';
        this.newMember.fullName=this.newMember.firstName+this.newMember.middleName+this.newMember.lastName;
        if (this.newMember.gpType==='Associate'&&!this.newMember.primaryUserId){
          this.toaster.error('Error','You must have a Primary Member`s Id entered for an Associate account');
          return;
        }
        let nm=JSON.parse(JSON.stringify(this.newMember));
        this.http.post('/api/customers',nm).then(res=>{
          nm=res.data;
          //send a welcome email
          if (nm.email) this.sendWelcomeEmail(nm.email);
          //if (nm.email) this.http.post('/api/things/welcomeEmail',{to:nm.email,html:this.welcomeEmail}).then(res=>{}).catch(err=>{console.log(err)});
          //set up initial transaction for new Member
          let transaction=res.data;
          delete transaction._id;
          transaction.awardRedeem='award';
          transaction.description="New GP Member Account Sign Up";
          transaction.date=new Date();
          transaction.dateFlown=new Date().toLocaleDateString();
          transaction.status="Approved";
          transaction.lastUpdatedBy=this.user._id;
          this.http.post('/api/transactions',transaction).then(res=>{
            //navigate to Manage Members with this nm selected
            nm.selected=true;
            if (nm.currentPoints!==0) nm.currentPoints=nm.currentPoints||nm.points;
            this.chosenView="Manage Members";
            this.select(nm);
          }).catch(err=>{console.log(err)});
          if (nm==='Associate'){
            this.http.post('/api/customers/one',{userId:nm.primaryUserId}).then(res=>{
              if (!res.data||!res.data.userId) return;
              let accounts=res.data.associatedAccounts||[];
              if (!Array.isArray(accounts)) return;
              if (accounts.indexOf(nm.userId)>-1) return;
              accounts.push(nm.userId);
              this.http.patch('/api/customers/'+res.data._id,{associatedAccounts:accounts}).then(res=>{}).catch(err=>{console.log(err)});
             })
             .catch(err=>{console.log(err)});
          }
          this.newMember={gpType:'Primary',associates:[{},{},{},{}]};
          this.existing={associates:['','','','']};
        }).catch(err=>{console.log(err)});
      })
      .catch(err=>{console.log(err)});
    }
    
    sendWelcomeEmail(email){
      this.http.post('/api/things/welcomeEmail',{to:email,html:this.welcomeEmail}).then(res=>{
        this.toaster.success('Success','Email Sent Successfully');
      }).catch(err=>{
        console.log(err);
        this.toaster.error('Error','Welcome Email Failed to Send');
      });
    }
    
    combinePoints(){
      if (this.transaction.awardRedeem==='award') {
        this.transaction.maxPoints='';
        return;
      }
      if (this.customer) this.transaction.maxPoints=this.customer.combinedPoints;
    }
    
    //look for combined points within the membership before completing assign
    assignPre(transaction){
      transaction=transaction||this.transaction;
      transaction.points=transaction.points*1;
      //update description
      if (!transaction.description) transaction.description='';
      if (transaction.dateFlown||transaction.booking||transaction.route||transaction.flight) {
        transaction.description+=transaction.dateFlown+ ' '+transaction.booking+' '+transaction.route+' '+transaction.flight+' Agent ID: '+transaction.lastUpdatedBy;
      }
      //send it
      if (transaction.awardRedeem==='award') {
        this.assign(transaction);
        return;
      }
      this.assignRedeem(transaction);
    }
    
    assignRedeem(transaction){
      transaction=transaction||this.transaction;
      transaction.points=transaction.points*1;
      let combinedPoints=this.customer.combinedPoints;
      if (combinedPoints!==0) combinedPoints=combinedPoints||this.customer.currentPoints;
      this.http.post('/api/customers/one',{userId:this.customer.userId}).then(res=>{
        if (!res.data||!res.data.userId) {
          this.toaster.error('Error','Didn`t find that User ID');
          return;
        }
        if (res.data.suspended) {
          this.toaster.error('Error','Need to remove customer suspension first');
          return;
        }
        //for this.associated help, figure out how much of each you need to make the total points
        if (this.customer.combinedPoints<transaction.points) {
          this.toaster.error('Error','Not enough points for this.');
          return;
        }
        let pointsLeft=transaction.points;
        if (this.customer.currentPoints>=transaction.points) {
          pointsLeft=0;
          this.customer.currentPoints-=transaction.points;
        }
        else {
          this.transaction.points=this.customer.currentPoints;
          pointsLeft-=this.customer.currentPoints;
          this.customer.currentPoints=0;
        }
        console.log(transaction)
        this.assign(transaction);
        
        let x=1;
        if (pointsLeft<=0) return;
        //go through associate accounts to get the rest
        this.associated.forEach(ass=>{
          if (pointsLeft<=0) return;
          if (ass.currentPoints<=0) return;
          let assTransaction=JSON.parse(JSON.stringify(transaction));
          assTransaction.userId=ass.userId;
          if (ass.currentPoints>=pointsLeft) {
            assTransaction.points=pointsLeft;
            pointsLeft=0;
          }
          else {
            assTransaction.points=ass.currentPoints;
            pointsLeft-=ass.currentPoints;
          }
          this.timeout(()=>{this.assign(assTransaction);},x*250);
          x++;
        });
      }).catch(err=>{console.log(err)});
    }
    
    assign(transaction){
      transaction=transaction||this.transaction;
      transaction.points=transaction.points*1;
      if (!Number.isInteger(transaction.points)||!transaction.userId||transaction.points<1) {
        this.toaster.error('Error','Missing Information!');
        return;
      }
      this.http.post('/api/customers/one',{userId:transaction.userId}).then(res=>{
        let customer=res.data;       
        if (res.data.suspended) {
          this.toaster.error('Error','Need to remove customer suspension first');
          return;
        }
        if (transaction.awardRedeem==='redeem'&&(customer.currentPoints*1<transaction.points)) {
          this.toaster.error('Error','Customer only has ' + customer.currentPoints + ' points');
          return; 
        }
        transaction.date=new Date();
        if (!transaction.dateFlown) transaction.dateFlown=new Date().toLocaleDateString();
        else if (transaction.dateFlown.split('/').length===2) transaction.dateFlown+='/'+new Date().getFullYear();
        else if (transaction.dateFlown.split('/').length<2) transaction.dateFlown=transaction.date.toLocaleDateString();
        transaction.lastUpdatedBy=this.user._id;
        this.http.post('/api/transactions/new',transaction).then(res=>{
            
          this.http.post('/api/customers/one',{userId:customer.userId})
            .then(res=>{
              customer=res.data;
              let index=this.customers.map(e=>e.userId).indexOf(customer.userId);
              if (index>-1) this.customers[index]=customer;
              //email receipt
              let awardRedeem="awarded";
              if (transaction.awardRedeem==="redeem") awardRedeem="withdrawn from";
              let html="You have a new transaction related to your Bering Air Gold Points Membership User ID# " + customer.userId + ".<br>";
              html+="We have " + awardRedeem + " you " + transaction.points + " points for an updated balance of " + customer.currentPoints + ".<br>";
              html+="If you have any questions, please contact Bering Air.";
              if (customer.email) this.http.post('/api/things/email',{to:customer.email,html:html}).then(res=>{}).catch(err=>{console.log(err)});
            })
            .catch(err=>{console.log(err)});
            
          this.transaction={status:'Approved',awardRedeem:'award',points:0};
        }).catch(err=>{console.log(err)});
      }).catch(err=>{console.log(err)});
    }
    
    reset(user){
      this.http.post('/api/users/query',user).then(res=>{
        this.http.post('/api/users/reset',res.data).then(res=>{
          this.toaster.success('Success','Password reset to `test`');
        })
        .catch(err=>{
          console.log(err);
        this.toaster.error('Error','Unable to reset this password!');
        });
      }).catch(err=>{
        console.log(err);
        this.toaster.error('Error','No user created with an email that matches this member`s email!');
      });
    }
    
    altSelect(cust,fieldName){
      if (this.chosenView==='Manage Members'&&fieldName==='userId') return;
      if (fieldName==='account') {
        if (this.chosenView==='Manage Members') this.chosenView="Assign Points";
        else if (this.chosenView==='Assign Points') this.chosenView="Manage Members";
      }
      cust.selected=!cust.selected;
      this.select(cust);
    }
    
    select(cust){
       this.selectedAssociate=undefined;
       this.customer=JSON.parse(JSON.stringify(cust));
       this.associated=[];
       this.customer.combinedPoints=this.customer.currentPoints;
       if (this.customer.associatedAccounts) {
         let fail=false;
         let promises = this.customer.associatedAccounts.map(ass => {
          return this.http.post('/api/customers/one', { userId: ass })
          .then(res => {
            this.customer.combinedPoints+=res.data.currentPoints;
            this.associated.push(res.data);
            return 'success';
          })
          .catch(err=>{
            console.log(err);
            fail=true;
            this.toaster.error('Error','Associate User ID ' + ass + ' is not Found!');
            return null;
          });
        });
        Promise.all(promises).then(results => {
          if (!fail) {
            let i=this.customers.map(e=>e.userId).indexOf(this.customer.userId);
            if (i>-1) this.customers[i].combinedPoints=this.customer.combinedPoints;
          }
        }).catch(err=>{console.log(err)});
       }
       
      if (this.chosenView==='Manage Members') {
         //if (!cust.selected) return;
         let queryUsers=[];
         if (this.customer.associatedAccounts&&Array.isArray(this.customer.associatedAccounts)) queryUsers=JSON.parse(JSON.stringify(this.customer.associatedAccounts));
         queryUsers.push(cust.userId);
         this.http.post('/api/transactions/query',{queryUsers:queryUsers}).then(res=>{
         //this.http.post('/api/transactions/query',{userId:cust.userId}).then(res=>{
           cust.selected=undefined;
           this.customerTransactions=res.data.sort((a,b)=>{
             let arrA=a.dateFlown.split('/');
             if (arrA.length===2) {
               if (a.date instanceof Date) a.dateFlown+='/'+a.date.getFullYear();
               else a.dateFlown+='/2026';
             }
             if (arrA.length<2) a.dateFlown=new Date(a.date).toLocaleDateString();
             let arrB=b.dateFlown.split('/');
             if (arrB.length===2) {
               if (b.date instanceof Date) b.dateFlown+='/'+b.date.getFullYear();
               else b.dateFlown+='/2026';
             }
             if (arrB.length<2) b.dateFlown=new Date(b.date).toLocaleDateString();
             return new Date(a.dateFlown) - new Date(b.dateFlown);
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
      this.toaster.pop('info','Member Selected!','Check to see that Account and Member ID have been filled with this Member`s information!');
      if (!cust.selected) {
        this.transaction={status:'Approved',awardRedeem:'award',points:0};
        return;
      }
      this.timeout(()=>{cust.selected=undefined},1000);
      this.transaction.account=cust.account;
      this.transaction.userId=cust.userId;
    }
    
    suspendMember(cust){
      cust.suspended=!cust.suspended;
      this.http.patch('/api/customers/'+cust._id,{suspended:cust.suspended}).then(res=>{}).catch(err=>{console.log(err)});
    }
    
    suspensionClass(cust){
      if (cust.suspended) return "suspended";
    }
    
    deleteTransaction(tran,index,all){
      if (confirm('Are you sure you want to delete this transaction?')){
        this.http.delete('/api/transactions/'+tran._id).then(res=>{
          if (all) this.allTransactions.splice(index,1);
          else this.customerTransactions.splice(index,1);
          this.http.post('/api/customers/one',{userId:tran.userId}).then(res=>{
            if (!res.data||!res.data.userId) return;
            if (tran.awardRedeem==="award") res.data.currentPoints-=tran.points;
            else res.data.currentPoints+=tran.points;
            this.http.patch('/api/customers/'+res.data._id,{currentPoints:res.data.currentPoints}).then(res=>{}).catch(err=>{console.log(err)});
          }).catch(err=>{console.log(err)});
            
        }).catch(err=>{console.log(err)});
      }
    }
    
    copyToClipboard(str){
      // eslint-disable-next-line no-undef
      if (!navigator.clipboard) {
        this.toaster.error('Error','Could not copy to clipboard, use CTRL-C instead');
        return;
      }
      // eslint-disable-next-line no-undef
      navigator.clipboard.writeText(str).then(()=>{this.toaster.success('Success','Copied ' + str + ' to your clipboard')});
    }
    
    backToHub(){
      this.transaction={status:'Approved',awardRedeem:'award',points:0};
      this.query={};
      this.newMember={gpType:'Primary',associates:[{},{},{},{}]};
      this.existing={associates:['','','','']};
      this.chosenView=null;
      this.queryGo=null;
      this.showTransactions=false;
    }
    
    retryQuery(){
      this.queryGo=null;
    }
    
    setView(index){
      if (this.user.role==='guest'&&index>0) {
        this.toaster.error('Error','This Selection is Restricted to Employee Users.  Contact Site Admin if You Believe This is in Error.');
        return;
      }
      this.queryGo=null;
      if (this.user.role==="guest") {
        this.queryGo=true;
        this.go();
      }
      this.chosenView=this.views[index];
      this.showTransactions=false;
      if (index===5){
        this.http.get('/api/customers').then(res=>{
          this.allCustomers=res.data;
        }).catch(err=>{console.log(err)});
      }
      if (index===6){
        this.http.get('/api/transactions').then(res=>{
          this.manyTransactions=res.data;
        }).catch(err=>{console.log(err)});
      }
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
            this.sendWelcomeEmail(this.customer.email);
          }
          this.customers[index]=res.data;
        }
        this.toaster.success('Success','Successfully Updated Member Details!');
      }).catch(err=>{
        console.log(err);
        this.toaster.error('Error','Try Again!');
      });
    }
    
    undoST(){
      this.showTransactions=false;
      this.queryGo='go';
      this.customer=undefined;
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
            if (cust.currentPoints!==0) cust.currentPoints=cust.currentPoints||cust.points;
            if (!cust.gpType) cust.gpType='Primary';
          });
          this.start=0;
          if (this.customers.length===0) this.start=-1;
          this.end=this.customers.length-1;
          this.queryGo='go';
        })
        .catch(err=>{console.log(err)});
    }
    
    preTransfer(){
      let combinedPoints=this.customer.combinedPoints;
      if (combinedPoints!==0) combinedPoints=combinedPoints||this.customer.currentPoints;
      if (this.gpTransfer.points>combinedPoints) {
        this.toaster.error('Error','Try again with an available amount of points');
        return;
      }
      if (this.customer.suspended) {
        this.toaster.error('Error','Need to remove customer suspension first');
        return;
      }
      if (this.user.role==='guest'){
        this.randomNumber=this.twoFA(this.customer);
      }
      else this.transfer();
    }
    
    transfer(){
      if (this.user.role==='guest'){
        if (this.randomNumber*1!==this.enteredRandomNumber*1) {
          this.toaster.error('Fail','Six Digit Code Did not Match, try again.');
          this.randomNumber=null;
          this.enteredRandomNumber=null;
          return;
        }
      }
      this.randomNumber=null;
      this.enteredRandomNumber=null;
      let combinedPoints=this.customer.combinedPoints;
      if (combinedPoints!==0) combinedPoints=combinedPoints||this.customer.currentPoints;
      this.http.post('/api/customers/one',{userId:this.gpTransfer.userId}).then(res=>{
        if (!res.data||!res.data.userId) {
          this.toaster.error('Error','Didn`t find that User ID');
          return;
        }
        if (res.data.suspended) {
          this.toaster.error('Error','Need to remove customer suspension first');
          return;
        }
        if (confirm('Confirm transferring ' + this.gpTransfer.points + ' to ' + res.data.fullName + ' with user ID of ' + this.gpTransfer.userId)) {
          let i=this.customers.map(e=>e.userId).indexOf(res.data.userId);
          if (i<0) this.customers.push(res.data);
          let transaction={userId:this.customer.userId,awardRedeem:'redeem',points:this.gpTransfer.points,
              description:'GP Transfer from '+ this.customer.fullName+', User ID: '  + this.customer.userId +' to ' + res.data.fullName + ', User ID: ' + this.gpTransfer.userId,
              status:'Approved'
          };
          let awardTransaction=JSON.parse(JSON.stringify(transaction));
          awardTransaction.awardRedeem='award';
          awardTransaction.userId=res.data.userId;
          //for this.associated help, figure out how much of each you need to make the total points
          let pointsLeft=this.gpTransfer.points;
          if (this.customer.currentPoints>=this.gpTransfer.points) {
            pointsLeft=0;
            this.customer.currentPoints-=this.gpTransfer.points;
          }
          else {
            transaction.points=this.customer.currentPoints;
            awardTransaction.points=this.customer.currentPoints;
            pointsLeft-=this.customer.currentPoints;
            this.customer.currentPoints=0;
          }
          
          this.assign(transaction);
          
          let x=1;
          this.timeout(()=>{this.assign(awardTransaction);},x*250);
          x++;
          this.gpTransfer={};
          if (pointsLeft<=0) return;
          //go through associate accounts to get the rest
          this.associated.forEach(ass=>{
            if (pointsLeft<=0) return;
            if (ass.currentPoints<=0) return;
            let assTransaction=JSON.parse(JSON.stringify(transaction));
            assTransaction.description='GP Transfer from '+ ass.fullName+', User ID: '  + ass.userId +' to ' + res.data.fullName + ', User ID: ' + res.data.userId;
            assTransaction.userId=ass.userId;
            if (ass.currentPoints>=pointsLeft) {
              assTransaction.points=pointsLeft;
              pointsLeft=0;
            }
            else {
              assTransaction.points=ass.currentPoints;
              pointsLeft-=ass.currentPoints;
            }
            this.timeout(()=>{this.assign(assTransaction);},x*250);
            x++;
            let assAwardTransaction=JSON.parse(JSON.stringify(awardTransaction));
            assAwardTransaction.points=assTransaction.points;
            assAwardTransaction.description=assTransaction.description;
            this.timeout(()=>{this.assign(assAwardTransaction);},x*250);
            x++;
          });
        }
      }).catch(err=>{console.log(err)});
    }
    
  twoFA(cust){
    if (!cust||!cust.phone) {
      this.toaster.error('No Phone!','We need a phone number associated with your account to authenticate a transfer.  Edit this in `Manage Members`');
      return "Error";
    }
    const randomNumber = Math.floor(100000 + Math.random() * 900000);
    const msg="NOREPLY: Bering Air Gold Points Authentication token is " + randomNumber + " Enter it in the browser to confirm your transfer.";
    this.http.post('/api/things/sms',{to:cust.phone,body:msg}).then(res=>{}).catch(err=>{console.log(err)});
    return randomNumber;
  }
    
    
  }

  angular.module('goldPointsApp')
    .component('main', {
      templateUrl: 'app/main/main.html',
      controller: MainController,
      controllerAs: 'main'
    });
})();
