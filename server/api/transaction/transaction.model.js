'use strict';

export default function(sequelize, DataTypes) {
  return sequelize.define('Transaction', {
    _id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      autoIncrement: true
    },
    userId: DataTypes.STRING,
    account: DataTypes.STRING,
    date: DataTypes.DATE,
    dateFlown: DataTypes.STRING,
    booking: DataTypes.STRING,
    route: DataTypes.STRING,
    flight: DataTypes.STRING,
    roundTrip:{
      type:DataTypes.BOOLEAN,
      default:false
    },
    awardRedeem: DataTypes.STRING,
    points: DataTypes.INTEGER,
    pointsRedeemed: DataTypes.INTEGER,
    pointsEarned: DataTypes.INTEGER,
    lastUpdatedBy: DataTypes.INTEGER,
    status:DataTypes.STRING,
    description:DataTypes.STRING
  });
}
