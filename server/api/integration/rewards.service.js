'use strict';

// Marketing tiers from beringair.com/gold-points-rewards-program (see resBering/docs/gold-points-rewards-program.md)
const REWARD_TIERS = [
  {
    points: 1000,
    label: 'Round-trip ticket anywhere worldwide',
    benefits: { airline: 'worldwide_rt' }
  },
  {
    points: 800,
    label: 'Round-trip ticket in North America, Europe, or Australia',
    benefits: { airline: 'na_eu_au_rt' }
  },
  {
    points: 400,
    label: 'Round-trip ticket within the United States',
    benefits: { airline: 'us_rt' }
  },
  {
    points: 200,
    label: '10,000 miles on available airlines',
    benefits: { airline: 'miles_10000' }
  },
  {
    points: 100,
    label: 'Round-trip ticket on Bering Air; ATV/snowmobile shipping on Bering Air',
    benefits: { ticket: 'bering_rt', freight: 'atv_snowmobile' }
  },
  {
    points: 50,
    label: '50% off next Bering Air ticket; $50 companion fare; 250 lbs freight; one-way Bering Air ticket',
    benefits: { ticketDiscount: 50, companionFare: 50, freightLbs: 250, ticket: 'bering_oneway' }
  },
  {
    points: 20,
    label: '20% off next Bering Air ticket; 100 lbs freight',
    benefits: { ticketDiscount: 20, freightLbs: 100 }
  },
  {
    points: 10,
    label: '10% off next Bering Air ticket; 50 lbs freight',
    benefits: { ticketDiscount: 10, freightLbs: 50 }
  }
];

const FARE_BENEFIT_KEYS = ['ticketDiscount', 'ticket', 'companionFare', 'airline'];
const FREIGHT_BENEFIT_KEYS = ['freightLbs', 'freight'];

function summarizeTier(tier) {
  return {
    points: tier.points,
    label: tier.label,
    benefits: tier.benefits
  };
}

export function listRewardTiers() {
  return REWARD_TIERS.map(summarizeTier);
}

export function tierSupportsRedemptionType(tier, redemptionType) {
  const benefits = tier.benefits || {};
  if (redemptionType === 'freight') {
    return FREIGHT_BENEFIT_KEYS.some(key => benefits[key] !== undefined);
  }
  if (redemptionType === 'fare') {
    return FARE_BENEFIT_KEYS.some(key => benefits[key] !== undefined);
  }
  return false;
}

export function redemptionBenefitForTier(tier, redemptionType) {
  const benefits = tier.benefits || {};
  if (redemptionType === 'freight') {
    if (benefits.freightLbs !== undefined) {
      return {freightLbs: benefits.freightLbs};
    }
    if (benefits.freight !== undefined) {
      return {freight: benefits.freight};
    }
    return null;
  }
  if (redemptionType === 'fare') {
    const fareBenefit = {};
    FARE_BENEFIT_KEYS.forEach(key => {
      if (benefits[key] !== undefined) {
        fareBenefit[key] = benefits[key];
      }
    });
    return Object.keys(fareBenefit).length ? fareBenefit : null;
  }
  return null;
}

export function availableRewards(balance) {
  const points = balance * 1 || 0;
  return REWARD_TIERS.filter(tier => points >= tier.points).map(summarizeTier);
}

export function availableRewardsByType(balance, redemptionType) {
  return availableRewards(balance).filter(tier => tierSupportsRedemptionType(
    REWARD_TIERS.find(row => row.points === tier.points),
    redemptionType
  ));
}

export function findTier(points) {
  return REWARD_TIERS.find(tier => tier.points === points * 1) || null;
}

export function validateTierRedemption(tierPoints, redemptionType) {
  const tier = findTier(tierPoints);
  if (!tier) {
    const err = new Error('Unknown reward tier');
    err.status = 400;
    throw err;
  }
  if (redemptionType !== 'fare' && redemptionType !== 'freight') {
    const err = new Error('redemptionType must be fare or freight');
    err.status = 400;
    throw err;
  }
  if (!tierSupportsRedemptionType(tier, redemptionType)) {
    const err = new Error('Tier ' + tier.points + ' does not support ' + redemptionType + ' redemption');
    err.status = 400;
    throw err;
  }
  return {
    tier: summarizeTier(tier),
    appliedBenefit: redemptionBenefitForTier(tier, redemptionType)
  };
}
