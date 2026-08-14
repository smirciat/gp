'use strict';

(function() {

  class MainController {

    constructor($http, $scope, socket,Auth,User,$timeout,toaster,Modal) {
      this.isLoggedIn=Auth.isLoggedIn;
      this.hasRole=Auth.hasRole;
      this.isAdmin=Auth.isAdmin;
      this.User=User;
      this.http = $http;
      this.scope=$scope;
      this.socket = socket;
      this.timeout=$timeout;
      this.toaster=toaster;
      this.Modal=Modal;
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
      this.views=['Manage Members','Approve Points','Add User','Assign Points','Create Member','List By Points','All Transactions','After Flight Completed'];
      this.welcomeEmail="Congratulations! <br><br>You have just created a Bering Air Gold Points Membership!<br><br>";
      this.welcomeEmail+="Please head over to gp.beringair.com to complete your sign in and access your account data. Your username is the same email address there that you used when you signed up for the Gold Points Membership.  Your temporary password is shown at the bottom of this email.  Once signed in, you will be able to see any future Gold Points transactions that are attached to this account.  Please let us know if you have any questions or difficulties. <br><br>Thank you for flying with Bering Air!";
    }

    $onInit() {
      this.flightDate=new Date();
      this.user=this.User.get(res=>{
        if (res.role==="guest"&&res.email){
          //setup public customers
          this.query={email:res.email};
          this.queryGo='go';
          this.go();
        }
      });
      this.scope.$watch('main.transferComplete',(newVal,oldVal)=>{
        if (newVal===true&&this.user&&this.user.role==='guest') window.location.reload();
        this.transferComplete=false;
      });
      //this.http.post('/api/things/ssm').then(res=>{console.log(res)}).catch(err=>{console.log(err)})
      this.http.post('/api/flights/query',{dateString:'6/11/2026',flightNumber:'822'}).then(res=>{
        console.log(res.data);
      }).catch(err=>{console.log(err)});
      this.transactionModal=this.Modal.confirm.transaction(response=>{
        if (!response.transaction.description) response.transaction.description='';
        if (response.transaction.description.length<=5&&(response.transaction.dateFlown||response.transaction.booking||response.transaction.route||response.transaction.flight)) {
          response.transaction.description+='=>' +response.transaction.dateFlown+ ' '+response.transaction.booking+' '+response.transaction.route+' '+response.transaction.flight+' Agent ID: '+this.user._id;
        }
        this.http.patch('/api/transactions/'+response.transaction._id,{newTransaction:response.transaction,oldTransaction:this.oldTransaction}).then(res=>{
          this.toaster.success('Error','Successfully edited transaction');
          
          if (this.customer&&this.customer.userId===response.transaction.userId) {
            this.http.post('/api/customers/one', { userId: this.customer.userId }).then(res => {
              this.customer=res.data;
              let index=this.customers.map(e=>e.userId).indexOf(res.data.userId);
              if (index>-1) this.customers[index]=res.data;
            })
            .catch(err=>{console.log(err)});
          }
        }).catch(err=>{
          console.log(err);
          this.toaster.error('Error','Failed to edit transaction');
        });
        
      });
      this.upDate();
    }
    
    upDate(key){
      if (key==='string') this.flightDate=new Date(this.flightDateStringFormatted);
      this.flightDateString=this.flightDate.toLocaleDateString();
      this.flightDateStringFormatted=this.flightDate.toLocaleDateString('en-US', { 
          weekday: 'short', 
          year: 'numeric', 
          month: 'numeric',//''long', 
          day: 'numeric' 
      });
    }
    
    handleFlight(event){
    if (event.keyCode === 13 && !event.shiftKey) {
      event.preventDefault(); 
      this.upDate('string');
    }
  }
    
    handle(event,source) {
      if (event.keyCode === 13 && !event.shiftKey) {
          event.preventDefault(); // Stops the newline from being added
          if (source===1) this.createNewMember();
          if (source===2) this.go();
          if (source===3) this.assign();
          if (source===4) this.processExisting();
          if (source===5) this.processAssociate();
          if (source===6) this.showAllPassengers();
      }
    }
    
    useId(possible,pass){
      pass.userId=possible.userId;
    }
    
    showAllPassengers(){
      this.http.post('/api/flights/query',{dateString:this.flightDate,flightNumber:this.flightNumber}).then(res=>{
        this.flightObj=res.data;
        this.flightObj.flight.passengers.forEach(pass=>{
          let firstName=pass.name.firstName;
          let lastName=pass.name.lastName;
          this.http.post('/api/customers/query',{query:{firstName:firstName,lastName:lastName}}).then(res=>{
            pass.possibleIds=res.data;
            if (res.data.length===0) {
              if (firstName) firstName=firstName.substring(0,4);
              if (lastName) lastName=lastName.substring(0,4);
              this.http.post('/api/customers/query',{query:{firstName:firstName,lastName:lastName}}).then(res=>{
                pass.possibleIds=res.data;
              });
            }
          })
          .catch(err=>{
            console.log(err);
            //this.toaster.error('Error','No Match found for ' + pass.name.firstName + ' ' + pass.name.lastName);
          });
        });
      })
      .catch(err=>{
        console.log(err);
        this.flightObj=null;
        this.toaster.error('Error','No matching flight for that date and flight number yet.  Mark the flight completed first in Takeflite.');
      });
    }
    
    processAssociate(){
      this.http.post('/api/customers/one', { userId: this.changingAssociate }).then(res => {
        let customer=res.data;
        if (confirm('Are you sure you want to promote associate member ' + customer.fullName + '?')) {
          let primaryUserId=customer.primaryUserId;
          customer.gpType="Primary";
          customer.associatedAccounts=[];
          customer.primaryUserId=null;
          customer.account=Number(new Date().toISOString().split('T')[0].replace(/-/g, ''))+customer.userId;
          this.http.post('/api/customers/one', { userId: primaryUserId }).then(res => {
            let primary=res.data;
            primary.associatedAccounts=primary.associatedAccounts.filter(id=>id!==customer.userId);
            this.http.patch('/api/customers/'+primary._id, { associatedAccounts: primary.associatedAccounts }).then(res => {
              this.http.patch('/api/customers/'+customer._id,customer).then(res => {
                this.customer=undefined;
                this.changingAssociate=undefined;
                this.toaster.success('Success','Successfully promoted Member to Primary, and updated ' + primary.fullName + '`s list of Associates');
              })
              .catch(err=>{
                console.log(err);
              this.toaster.error('Error','Failed to Update, try again');
              });
            })
            .catch(err=>{
              console.log(err);
              this.toaster.error('Error','Failed to Update, try again');
            });
          })
            .catch(err=>{
              console.log(err);
              this.toaster.error('Error','Can`t find that member`s primary ID');
            });
        }
      })
      .catch(err=>{
        console.log(err);
        this.toaster.error('Error','Can`t find that Member ID');
      });
    }
    
    deleteMember(){
      this.http.post('/api/customers/one', { userId: this.deletingMember }).then(res => {
        if (confirm('Are you sure you want to delete ' + res.data.fullName + '?')) {
          this.http.delete('/api/customers/'+res.data._id).then(res => {
            this.toaster.success('Success','Successfully deleted ' + this.deletingMember);
          }).catch(err=>{
            console.log(err);
            this.toaster.error('Error','Failed to delete ' + this.deletingMember);
          });
        }
      }).catch(err=>{
        console.log(err);
        this.toaster.error('Error','Failed to find ' + this.deletingMember + ' in the database');
      });
    }
    
    processExisting(swap){
      let associates=JSON.parse(JSON.stringify(this.existing.associates));
      //up to 5 userId s find each one if the exist and update: primaryUserId for associate, associate array for primary
      if (!this.existing.primary||(!this.existing.associates[0]&&!this.existing.associates[1]&&!this.existing.associates[2]&&!this.existing.associates[3])) return;
      //if not swapping within an existing group, don't add current primary members as associates
      let primaryFail=false;
      let associateFail=false;
      let fail = false;
      //primary
      this.http.post('/api/customers/one', { userId: this.existing.primary }).then(res => {
        if (!res.data || !res.data.userId) return;
        let primary = JSON.parse(JSON.stringify(res.data));
        if (!swap&&(primary.gpType==="Associate"||primary.primaryUserId)){
          this.toaster.error('Error','Suggested Primary is already someone`s associate, promote them to Primary first');
          return;
        }
        primary.associatedAccounts = primary.associatedAccounts || [];
        associates.forEach(ass => {
          primary.associatedAccounts.push(ass);
          // remove duplicates and blanks
          primary.associatedAccounts = [...new Set(primary.associatedAccounts.filter(str => str !== ""))];
        });
        console.log(primary.associatedAccounts);
        let deadAssociates=[];
        // create array of promises
        let promises = primary.associatedAccounts.map(ass => {
          return this.http.post('/api/customers/one', { userId: ass })
          .then(r => {
              return {ass: ass,data: r.data};
          })
          .catch(err=>{
            console.log(err);
            if (this.existing.associates.indexOf(ass)>-1) {
              this.toaster.error('Error','Associate User ID ' + ass + ' is not Found!');
              return {error:true};
            }
            deadAssociates.push(ass);
            associates=associates.filter(assLocal=>assLocal!==ass);
            return {ass: ass,data: null};
          });
        });
        return Promise.all(promises).then(results => {
          let assObjects = [];
          let names = [];
          results.forEach(result => {
              if (!result||result.error) {
                fail=true;
                return;
              }
              if (!result.data) {
                primary.associatedAccounts=primary.associatedAccounts.filter(assLocal=>assLocal!==result.ass);
                return;
              }
              //if (result.data.gpType==="Primary") primaryFail=true;
              if (Array.isArray(result.data.associatedAccounts)&&result.data.associatedAccounts.length>0) primaryFail=true;
              if (result.data.primaryUserId&&result.data.primaryUserId!==primary.userId) associateFail=true;
              assObjects.push(result.data);
              names.push('"' + result.data.fullName + '"');
          });
          let str = names.join(', & ');
          if (primaryFail&&!swap){
            this.toaster.error('Error','One or more of the accounts you are trying to add as an associate may be a primary');
            return;
          }
          if (associateFail&&!swap){
            this.toaster.error('Error','One or more of the accounts you are trying to add as an associate already has a primary member');
            return;
          }
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
            assObjects.forEach((obj,index)=>{
              if (!obj||!obj.userId) return;
              this.http.patch('/api/customers/'+obj._id,{gpType:"Associate",primaryUserId:primary.userId,associatedAccounts:[]}).then(res=>{
                if (index>=assObjects.length-1) this.toaster.success('Success','Primary and Associate memers updated successfully');
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
      if (this.newMember.email) this.newMember.email=this.newMember.email.toLowerCase();
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
        //before we create a new customer, we should check to see if one already existes with the same email
        this.http.post('/api/customers/query',{query:{email:nm.email},exact:true}).then(res=>{
          if (res.data.length===0){
            //no match, good to go
            this.postNewMember(nm);
          }
          else {
            //already exists, do you want to continue?
            if (confirm('There is already at least one Gold Points Member using that email address.  Continue to create a new Member with this information?')) {
              this.postNewMember(nm,true);
            }
            else this.toaster.info('Info','Save cancelled, update and try again, or go back to hub');
          }
        }).catch(err=>{
          console.log(err);
          if (err.status===404) window.location.reload();
          else this.toaster.error('Error','Query to find similar users failed, new member not created');
        });
          
      })
      .catch(err=>{
        console.log(err);
        this.toaster.error('Error','Failed to get a list of user id`s, new member not created');
      });
    }
    
    postNewMember(nm,duplicate){
      this.http.post('/api/customers',nm).then(res=>{
        nm=res.data;
        //send a welcome email
        if (nm.email&&!duplicate) this.sendWelcomeEmail(nm.email,nm);
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
            this.http.patch('/api/customers/'+res.data._id,{associatedAccounts:accounts}).then(res=>{
              this.toaster.success('Success','Successfully updated new member`s primary to include it');
            }).catch(err=>{
              console.log(err);
              this.toaster.error('Error','Failed to update Primary Member');
            });
           })
           .catch(err=>{
             console.log(err);
             this.toaster.error('Error','Failed to find User ID');
           });
        }
        this.newMember={gpType:'Primary',associates:[{},{},{},{}]};
        this.existing={associates:['','','','']};
      }).catch(err=>{
        console.log(err);
        this.toaster.error('Error','Failed to create new member');
      });
    }
    
    sendWelcomeEmail(email,customer){
      if (customer&&customer.badEmail){
        return this.toaster.error('Error','This customer`s email has been rejected in the past, cannot send to this email.');
      }
      this.http.post('/api/things/welcomeEmail',{to:email,customer:customer}).then(res=>{
        this.toaster.success('Success','Email Sent Successfully');
      }).catch(err=>{
        console.log(err);
        this.toaster.error('Error','Welcome Email Failed to Send');
      });
    }
    
    combinePoints(){
      if (this.transaction.awardRedeem==='award') {
        //this.transaction.maxPoints='';
        //return;
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
        transaction.description+='=>' +transaction.dateFlown+ ' '+transaction.booking+' '+transaction.route+' '+transaction.flight+' Agent ID: '+this.user._id;
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
      if (!this.customer) {
        this.toaster.error('Error','You need to select the customer from the query results below so that I can verify they have enough points to redeem');
        return;
      }
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
        if (Array.isArray(this.associated)&&this.associated.length===0) this.transferComplete=true;
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
      }).catch(err=>{
        console.log(err);
        this.toaster.error('Error','Failed to retrieve Customer');
      });
    }
    
    assign(transaction,associatedIndex){
      transaction=transaction||this.transaction;
      transaction.points=transaction.points*1;
      if (!Number.isInteger(transaction.points)||!transaction.userId||transaction.points<1) {
        this.toaster.error('Error','Missing Information!');
        return;
      }
      if (transaction.awardRedeem==='award'&&transaction.points>100) {
        this.toaster.error('Error','Award cannot exceed 100 points per transaction (flight awards are 5).');
        return;
      }
      if (transaction.awardRedeem==='redeem'&&transaction.points>1000) {
        this.toaster.error('Error','Redeem cannot exceed 1000 points per transaction.');
        return;
      }
      return this.http.post('/api/customers/one',{userId:transaction.userId}).then(res=>{
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
        return this.http.post('/api/transactions/new',transaction).then(res=>{
          //refresh customer after new transaction may have updated it  
          this.http.post('/api/customers/one',{userId:customer.userId})
            .then(res=>{
              customer=res.data;
              if (this.user.role==='guest') {
                this.customer=customer;
                //check if it is the end of a transfer, if so reload
                if (Array.isArray(this.associated)&&associatedIndex>=this.associated.length-1) {
                  this.timeout(()=>{this.transferComplete=true},2000);
                }
              }
              else {
                let index=this.customers.map(e=>e.userId).indexOf(customer.userId);
                if (index>-1) this.customers[index]=customer;
              }
              //email receipt
              let awardRedeem="awarded";
              if (transaction.awardRedeem==="redeem") awardRedeem="debited";
              let html="You have a new transaction related to your Bering Air Gold Points Membership User ID# " + customer.userId + ".<br>";
              html+="We have " + awardRedeem + " you " + transaction.points + " points for an updated balance of " + customer.currentPoints + ".<br>";
              html+="If you have any questions, please contact Bering Air.";
              if (customer.email&&!customer.badEmail) this.http.post('/api/things/email',{to:customer.email,html:html}).then(res=>{}).catch(err=>{
                console.log(err);
                this.toaster.info('Error','Confirmation Email failed to send, but Transaction went through OK');
              });
            })
            .catch(err=>{
              console.log(err);
              this.toaster.error('Error','Customer point total may be inaccurate, please check.');
            });
            
          this.transaction={status:'Approved',awardRedeem:'award',points:0};
          this.toaster.success('Success','Gold Points transaction successfully completed');
          return res;
        }).catch(err=>{
          console.log(err);
          this.toaster.error('Error','Failed to create new transaction.  Customer point total may be inaccurate, please check.');
        });
      }).catch(err=>{
        console.log(err);
        this.toaster.error('Error','Can`t find user id for the primary member');
      });
    }
    
    awardFlight(){
      if (!this.flightObj||!this.flightObj.flight||!this.flightObj.flight.passengers||this.flightObj.flight.passengers.length<1) {
        return this.toaster.error('Error','Please Load the Flight First');
      }
      let promises = this.flightObj.flight.passengers.map(pass => {
        if (!pass.userId||pass.transactionId) return pass;
        let transaction={status:'Approved',awardRedeem:'award',points:5,userId:pass.userId,date:new Date(this.flightObj.dateString),
            dateFlown:this.flightObj.dateString,booking:pass.bookingNumber,route:pass.boardPoint.code+'-'+pass.offPoint.code,
            flight:this.flightObj.flightNumber,lastUpdatedBy:0,description:pass.description
        };
        return this.assign(transaction).then(res=>{
          pass.transactionId=res.data._id;
          return pass;
        })
        .catch(err=>{
          console.log(err);
          return pass;
        });
      });
      Promise.all(promises).then(results => {
        this.http.patch('/api/flights/'+this.flightObj._id,{flight:this.flightObj.flight}).then(res=>{
          this.toaster.success('Success','Completed Flight is now updated and complete.');
        })
        .catch(err=>{console.log(err)});
      })
      .catch(err=>{console.log(err)});
    }
    
    reset(user){
      if (user.badEmail){
        return this.toaster.error('Error','Unable to reset this password, this email address has previously failed');
      }
      this.http.post('/api/users/query',user).then(res=>{
        this.http.post('/api/users/reset',res.data).then(res=>{
          this.toaster.success('Success','Password reset to temporary, email has been sent to provide it.');
        })
        .catch(err=>{
          console.log(err);
        this.toaster.error('Error','Unable to reset this password!');
        });
      }).catch(err=>{
        console.log(err);
        this.toaster.error('Error','No user created with an email that matches this member`s email!');
        //create new user matching that email
        this.http.post('/api/users',{email:user.email,name:user.fullName}).then(res=>{
          this.toaster.success('Success','New User Created, try to reset password again');
        }).catch(err=>{
          console.log(err);
          this.toaster.error('Error','Unable to create an new user with an email that matches this member`s email!');
        });
      });
    }
    
    returnToFlight(){
      this.frontDoor=false;
      this.chosenView="After Flight Completed";
    }
    
    memberQuery(){
      this.frontDoor=false;
      this.showTransactions=false;
      this.chosenView="Manage Members";
    }
    
    altSelect(cust,fieldName){
      console.log(cust)
      if (this.chosenView==='Manage Members'&&fieldName==='userId') return;
      if (typeof cust==='string') {
        this.http.post('/api/customers/one', { userId: cust }).then(res=>{
          cust=res.data;
          this.chosenView="Manage Members";
          cust.selected=true;
          this.select(cust);
          //this.showTransactions=true;
        });
      }
      else {
        if (fieldName==='account') {
          if (this.chosenView==='Manage Members') this.chosenView="Assign Points";
          else if (this.chosenView==='Assign Points') this.chosenView="Manage Members";
        }
        cust.selected=!cust.selected;
        this.select(cust);
      }
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
            this.combinePoints();
          }
        }).catch(err=>{console.log(err)});
       }
       
      if (this.chosenView==='Manage Members') {
         //if (!cust.selected) return;
         let queryUsers=[];
         if (this.customer.associatedAccounts&&Array.isArray(this.customer.associatedAccounts)) queryUsers=JSON.parse(JSON.stringify(this.customer.associatedAccounts));
         queryUsers.push(cust.userId);
         //get events from old system as well
         this.http.post('/api/events/query',{userId:this.customer.userId}).then(res=>{
           this.oldEvents=res.data.sort((a,b)=>a.event_id-b.event_id);
           let cp=0;
           this.oldEvents.forEach(event=>{
             cp+=event.points;
             event.cp=cp;
           });
         }).catch(err=>{
           console.log(err);
         });
         
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
           this.frontDoor=true;
         })
          .catch(err=>{
            console.log(err);
            this.toaster.error('Error','Search Query Failed');
          });
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
      this.http.patch('/api/customers/'+cust._id,{suspended:cust.suspended}).then(res=>{
        if (cust.suspended) this.toaster.warning('Warning','Customer has been suspended');
        else this.toaster.warning('Warning','Customer has been restored to active status');
      }).catch(err=>{console.log(err)});
    }
    
    suspensionClass(cust){
      if (cust.suspended) return "suspended";
    }
    
    editTransaction(tran,index,all){
      document.documentElement.style.setProperty('--modal-dialog-width', '95%');
      this.editableTransaction=tran;
      this.oldTransaction=JSON.parse(JSON.stringify(tran));
      this.transactionModal(tran);
    }
    
    deleteTransaction(tran,index,all){
      if (confirm('Are you sure you want to delete this transaction?')){
        this.http.delete('/api/transactions/'+tran._id).then(res=>{
          if (all==='all') this.allTransactions.splice(index,1);
          else if (all==='many') this.manyTransactions.splice(index,1);
          else this.customerTransactions.splice(index,1);
          const refreshUserId=tran.userId;
          if (this.customer&&this.customer.userId===refreshUserId) {
            this.http.post('/api/customers/one',{userId:refreshUserId}).then(res=>{
              if (!res.data||!res.data.userId) return;
              this.customer=res.data;
              const idx=this.customers.map(e=>e.userId).indexOf(res.data.userId);
              if (idx>-1) this.customers[idx]=res.data;
              this.toaster.success('Success','Deleted transaction and updated customer point total accordingly');
            }).catch(err=>{
              console.log(err);
              this.toaster.error('Error','Failed to refresh customer after deletion');
            });
          } else {
            this.toaster.success('Success','Deleted transaction and updated customer point total accordingly');
          }
        }).catch(err=>{
          console.log(err);
          this.toaster.error('Error','Failed to delete transaction');
        });
      }
    }
    
    copyToClipboard(str){
      // eslint-disable-next-line no-undef
      if (!navigator.clipboard) {
        this.toaster.error('Error','Could not copy to clipboard, use CTRL-C instead');
        return;
      }
      // eslint-disable-next-line no-undef
      navigator.clipboard.writeText(str).then(()=>{
        this.timeout(()=>{
          this.toaster.success('Success','Copied ' + str + ' to your clipboard');
        },0);
      });
    }
    
    backToHub(){
      this.oldEvents=[];
      if (this.user.role==='guest') {
        window.location.reload();
        return;
      }
      this.transaction={status:'Approved',awardRedeem:'award',points:0};
      this.query={};
      this.newMember={gpType:'Primary',associates:[{},{},{},{}]};
      this.existing={associates:['','','','']};
      this.chosenView=null;
      this.queryGo=null;
      this.flightObj=null;
      this.showTransactions=false;
      this.frontDoor=false;
    }
    
    retryQuery(){
      this.oldEvents=[];
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
          this.offset=0;
        }).catch(err=>{console.log(err)});
      }
      if (index===7){
        //After Flight Completed View
      }
    }
    
    nextGroup(){
      this.offset++;
      this.manyTransactions=[];
      this.http.post('/api/transactions/many',{offset:this.offset}).then(res=>{
        this.manyTransactions=res.data;
        
      }).catch(err=>{console.log(err)});
    }
    
    testView(view,otherView){
      if (!this.chosenView) return false;
      let index=this.views.indexOf(view);
      if (index<0) return false;
      otherView=otherView||'';
      return this.chosenView.toLowerCase()===view.toLowerCase()||this.chosenView.toLowerCase()===otherView.toLowerCase();
    }
    
    updateCustomerPre(){
      console.log(this.customer)
      if (!this.customer) return;
      let index=this.customers.map(e=>e.userId).indexOf(this.customer.userId);
      console.log(index)
      if (index>-1) {
        if (this.customers[index].email!==this.customer.email){
          this.customer.badEmail=false;
          if (this.customer.email) this.customer.email=this.customer.email.toLowerCase();
          //new email entered, send them one!
          //
          this.http.post('/api/users/query',{email:this.customer.email}).then(res=>{
            this.toaster.warning('Warning','There is already a Gold Points User using that email address');
            if (confirm('Are you sure you want to change this email address?  Email already exists.')) {
              if (this.customers[index].email) {
                this.http.post('/api/things/email',{to:this.customers[index].email,html:
                    'There has been a change of email address on a Gold Points member account previously associated with this email address.  If you did not initiate this, please contact Bering Air to confirm your Gold Points Membership details'
                }).then(res=>{});
              }
              this.sendWelcomeEmail(this.customer.email,this.customer);
              this.updateCustomer(index);
            }
            else this.toaster.error('Error','Customer Not Updated');
          })
          .catch(err=>{
            console.log(err);
            if (err&&err.status===404) this.toaster.warning('Warning','There is no Gold Points User with this email, you will need to have the customer register at gp.beringair.com');
            this.updateCustomer(index);
          });
        }
        else this.updateCustomer(index);
      }
      else this.updateCustomer(-1);
    }
    
    updateCustomer(index){
      
      if (this.customer.phone) this.customer.phone=this.customer.phone.replace(/\D/g, "");
      let obj={fullName:this.customer.fullName,email:this.customer.email,phone:this.customer.phone,dob:this.customer.dob,
          address:this.customer.address,city:this.customer.city,state:this.customer.state,zip:this.customer.zip,badEmail:this.customer.badEmail};
      this.http.patch('/api/customers/'+this.customer._id,obj).then(res=>{
        if (index>-1) {
          this.customers[index]=res.data;
        }
        this.toaster.success('Success','Successfully Updated Member Details!');
      }).catch(err=>{
        console.log(err);
        this.toaster.error('Error','Try Again!');
      });
    }
    
    undoST(){
      //this.flightObj=undefined;
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
        .catch(err=>{
          console.log(err);
          if (err.status===404) window.location.reload();
        });
    }
    
    preTransfer(){
      if (!this.gpTransfer.points||!this.gpTransfer.userId) {
        this.toaster.error('Error','Please enter the number of points to be transferred and a user ID to transfer to');
        return;
      }
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
        this.twoFA(this.customer);
      }
      else this.transfer();
    }
    
    checkRandomNumber(){
      if (this.user.role==='guest'){
        this.http.post('/api/things/verify',{customer:this.customer,randomNumber:this.enteredRandomNumber}).then(res=>{
          this.enteredRandomNumber=null;
          this.toaster.success('Success','Verification code is verified, beginning transfer');
          this.transfer();
        }).catch(err=>{
          console.log(err);
          this.toaster.error('Fail','Six Digit Code Did not Match, try again.');
          this.enteredRandomNumber=null;
        });
      }
      else {
        this.enteredRandomNumber=null;
        this.transfer();
      }
    }
    
    transfer(){
      this.transferComplete=false;
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
        if (confirm('Confirm transferring ' + this.gpTransfer.points + ' points to ' + res.data.fullName + ' with user ID of ' + this.gpTransfer.userId)) {
          //let i=this.customers.map(e=>e.userId).indexOf(res.data.userId);
          //if (i<0) this.customers.push(res.data);
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
          this.timeout(()=>{this.assign(awardTransaction,0);},x*250);
          x++;
          this.gpTransfer={};
          this.customer.combinedPoints=this.customer.currentPoints;
          if (pointsLeft<=0) {
            return;
          }
          //go through associate accounts to get the rest
          this.associated.forEach((ass,index)=>{
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
            this.timeout(()=>{this.assign(assAwardTransaction,index);},x*250);
            x++;
          });
        }
      }).catch(err=>{console.log(err)});
    }
    
  randomNumberDisabler(){
    if (this.randomNumber) return true;
  }
    
  twoFA(cust){
    if (!cust||!cust.phone) {
      this.toaster.error('No Phone!','We need a phone number associated with your account to authenticate a transfer.  Edit this in `Manage Members`');
      return "Error";
    }
    this.http.post('/api/things/twoFA',{customer:cust})
    .then(res=>{
      console.log(res.data);
      this.randomNumber=res.data;
      this.toaster.success('Success','Verification SMS message sent, check your phone for a verification code');
    })
    .catch(err=>{
      console.log(err);
      this.randomNumber='Error';
      this.toaster.error('Error','SMS Text Message failed to send, check your phone number');
    });
  }
    
    
  }

  angular.module('goldPointsApp')
    .component('main', {
      templateUrl: 'app/main/main.html',
      controller: MainController,
      controllerAs: 'main'
    });
})();
