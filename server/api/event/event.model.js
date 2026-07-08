'use strict';

export default function(sequelize, DataTypes) {
  return sequelize.define('Event', {
    event_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      unique:true
    },
    account_id: DataTypes.STRING,
    member_id: DataTypes.STRING,
    status: DataTypes.STRING,
    active_as_of: DataTypes.STRING,
    points: DataTypes.INTEGER,
    reservation_id: DataTypes.INTEGER,
    notes: DataTypes.STRING,
    modified: DataTypes.DATE,
    created: DataTypes.DATE,
    comments: DataTypes.STRING
  });
}
