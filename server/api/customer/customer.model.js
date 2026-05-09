'use strict';

export default function(sequelize, DataTypes) {
  return sequelize.define('Customer', {
    _id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      autoIncrement: true
    },
    lastTransaction:DataTypes.INTEGER,
    points:DataTypes.INTEGER,
    currentPoints:DataTypes.INTEGER,
    account:DataTypes.STRING,
    userId:{
      type:DataTypes.STRING,
      unique: true,
      allowNull: false
    },
    userName: DataTypes.STRING,
    fullName: DataTypes.STRING,
    email: DataTypes.STRING,
    phone: DataTypes.STRING,
    altName: DataTypes.STRING,
    active: {
      type:DataTypes.BOOLEAN,
      default:true
    },
    dob: DataTypes.STRING,
    address: DataTypes.STRING,
    city: DataTypes.STRING,
    state: DataTypes.STRING,
    zip: DataTypes.STRING,
    gpType: DataTypes.STRING,
    ca: DataTypes.STRING
  });
}
