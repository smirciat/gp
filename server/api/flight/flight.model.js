'use strict';

export default function(sequelize, DataTypes) {
  return sequelize.define('Flight', {
    _id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      autoIncrement: true
    },
    flight: DataTypes.JSONB,
    name: DataTypes.STRING,
    info: DataTypes.STRING,
    date: DataTypes.DATE,
    dateString: {
      type:DataTypes.STRING,
      allowNull: false,
      unique: 'date-flightnUm-pair',
      validate: {
        notEmpty: true // Prevents empty strings ("")
      }
    },
    flightNumber: {
      type:DataTypes.STRING,
      allowNull: false,
      unique: 'date-flightnUm-pair',
      validate: {
        notEmpty: true // Prevents empty strings ("")
      }
    },
    active: DataTypes.BOOLEAN
  });
}
