import { UserPlan } from '@/types';

export interface PlanDefinition {
  id: UserPlan;
  name: string;
  priceLabel: string;
  description: string;
  features: string[];
}

export const PLANS: Record<UserPlan, PlanDefinition> = {
  free: {
    id: 'free',
    name: 'Free',
    priceLabel: '$0',
    description: 'Share authentic moments with the community.',
    features: [
      'Create photo and video posts',
      'Follow friends and react supportively',
      'Earn points and badges',
    ],
  },
  plus: {
    id: 'plus',
    name: 'OMOF Plus',
    priceLabel: 'Mock trial',
    description: 'Support OMOF and unlock extra visibility tools.',
    features: [
      'Plus profile badge',
      '5 promoted-post credits',
      'Early access to new features',
      'Priority support (coming soon)',
    ],
  },
};

export const PLUS_TRIAL_CREDITS = 5;
export const PROMOTION_CREDIT_COST = 1;
