'use strict';

export default function(sequelize, DataTypes) {
  return sequelize.define(
    'BalanceMismatch',
    {
      userId: {
        type: DataTypes.STRING,
        allowNull: false,
        primaryKey: true
      },
      fullName: DataTypes.STRING,
      storedPoints: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      computedPoints: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      delta: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      checkedAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      firstDetectedAt: {
        type: DataTypes.DATE,
        allowNull: false
      }
    },
    {
      tableName: 'gp_balance_mismatch',
      timestamps: false
    }
  );
}
