'use strict';

import crypto from 'crypto';

var validatePresenceOf = function(value) {
  return value && value.length;
};

module.exports = function(sequelize, DataTypes) {
  var User = sequelize.define('User', {

    _id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      autoIncrement: true
    },
    name: DataTypes.STRING,
    email: {
      type: DataTypes.STRING,
      unique: {
        msg: 'The specified email address is already in use.'
      },
      validate: {
        isEmail: true
      }
    },
    role: {
      type: DataTypes.STRING,
      defaultValue: 'user'
    },
    password: {
      type: DataTypes.STRING,
      validate: {
        notEmpty: true
      }
    },
    provider: DataTypes.STRING,
    salt: DataTypes.STRING,
    job: DataTypes.STRING

  }

  , {

    /**
     * Virtual Getters
     */
    getterMethods: {
      // Public profile information
      profile: function() {
        return {
          'name': this.name,
          'role': this.role
        };
      },

      // Non-sensitive info we'll be putting in the token
      token: function() {
        return {
          '_id': this._id,
          'role': this.role
        };
      }
    },

    /**
     * Pre-save hooks
     */
    hooks: {
      beforeBulkCreate: function(users, fields, fn) {
        var totalUpdated = 0;
        users.forEach(function(user) {
          user.updatePassword(function(err) {
            if (err) {
              return fn(err);
            }
            totalUpdated += 1;
            if (totalUpdated === users.length) {
              return fn();
            }
          });
        });
      },
      beforeCreate: async function(user, fields, fn) {
        let resp=await user.updatePassword(fn,user.password,user.salt);
        this.password=resp.password;
        this.salt=resp.salt;
        return resp;
      },
      beforeUpdate: async function(user, fields, fn) {
        if (user.changed('password')) {
          let resp= await user.updatePassword(fn,user.password,user.salt);
          this.password=resp.password;
          this.salt=resp.salt;
          return resp;
        }
        if (fn) fn();
      }
    },

  }); 

  User.prototype.authenticate= async function(password,salt, callback) {
        if (!callback) {
          return this.password === await User.prototype.encryptPassword(password,salt);
        }

        var _this = this;
        User.prototype.encryptPassword(password,salt, function(err, pwdGen) {
          if (err) {
            callback(err);
          }

          if (_this.password === pwdGen) {
            callback(null, true);
          }
          else {
            callback(null, false);
          }
        });
      };



  User.prototype.makeSalt= async function(byteSize, callback) {
        var defaultByteSize = 16;

        if (typeof arguments[0] === 'function') {
          callback = arguments[0];
          byteSize = defaultByteSize;
        }
        else if (typeof arguments[1] === 'function') {
          callback = arguments[1];
        }

        if (!byteSize) {
          byteSize = defaultByteSize;
        }

        if (!callback) {
          return new Promise((resolve,reject)=>{
            crypto.randomBytes(byteSize).toString('base64');
            resolve();
          });
        }

        return new Promise((resolve,reject)=>{
          crypto.randomBytes(byteSize, async function(err, salt) {
            if (err) {
              callback(err);
            }
            let resp=await callback(null, salt.toString('base64'));
            resolve(resp);
            return resp;
          });
      });
  };

  User.prototype.encryptPassword=async function(password,Salt, callback) {
        if (!password || !Salt) {
          if (!callback) {
            return null;
          }
          return callback(null);
        }

        var defaultIterations = 10000;
        var defaultKeyLength = 64;
        var salt = new Buffer(Salt, 'base64');

        if (!callback) {
          let res= new Promise((resolve,reject)=>{
            crypto.pbkdf2Sync(password, salt, defaultIterations, defaultKeyLength,null)
                       .toString('base64');
            resolve();
          });
          return res;
        }

        return new Promise((resolve,reject)=>{
          crypto.pbkdf2(password, salt, defaultIterations, defaultKeyLength,null,
            async function(err, key) {
              if (err) {
                callback(err);
              }
              let resp=await callback(null, key.toString('base64'));
              resolve(resp);
              return resp;
            });
        });
      };

  User.prototype.updatePassword= async function(fn,password,salt) {
        var _this = this;
        // Handle new/update passwords
        if (password) {
          if (!validatePresenceOf(this.password)) {
            if (fn) fn(new Error('Invalid password'));
          }
          // Make salt with a callback
          await User.prototype.makeSalt(async function(saltErr, salt) {
            if (saltErr) {
              fn(saltErr);
            }
            _this.salt = salt;
            await User.prototype.encryptPassword(password,salt,async function(encryptErr, hashedPassword) {
              if (encryptErr) {
                if (fn) fn(encryptErr);
              }
              _this.password = hashedPassword;
              if (fn) fn(null);
            });
          });
          return _this;
        } else {
          if (fn) fn(null);
        }
      };
  
  return User;
};