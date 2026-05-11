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
    active: DataTypes.BOOLEAN
  });
}
