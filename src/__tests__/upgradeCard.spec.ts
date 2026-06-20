// @vitest-environment jsdom

import { beforeAll, describe, expect, it } from 'vitest';
import { renderUpgradeCard } from '../ui/upgradeCard';
import type { Entity, PlayerStartStats, UpgradeDef } from '../types';

const player: Entity = {
    id: 0,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    radius: 10,
    kind: 'player',
    damage: 5,
};

const base: PlayerStartStats = {
    hp: 10,
    maxHp: 10,
    damage: 5,
    speed: 80,
    attackSpeed: 1,
    boltSpeed: 100,
    pickupRange: 50,
    regen: 0,
    xpGain: 1,
    rerolls: 3,
    bans: 0,
};

const upgrade: UpgradeDef = {
    id: 'damage',
    name: 'Damage',
    description: 'More damage',
    apply: () => undefined,
};

describe('renderUpgradeCard', () => {
    beforeAll(() => {
        Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
            configurable: true,
            value: () => null,
        });
    });

    it('chooses the card when clicked', () => {
        let chose = 0;
        const card = renderUpgradeCard(upgrade, {
            player,
            base,
            rarity: 'common',
            onChoose: () => { chose++; },
        });

        card.click();

        expect(chose).toBe(1);
    });

    it('does not render modal-level reroll or ban actions inside cards', () => {
        const card = renderUpgradeCard(upgrade, {
            player,
            base,
            rarity: 'common',
        });

        expect(card.querySelector('button')).toBeNull();
    });

    it('groups magic orb variant cards under the Magic Orbs title', () => {
        const orbDamage: UpgradeDef = {
            id: 'magicOrbDamage',
            name: 'Magic Orbs Damage',
            description: 'More orb damage',
            apply: () => undefined,
        };
        const orbSpeed: UpgradeDef = {
            id: 'magicOrbSpeed',
            name: 'Magic Orbs Speed',
            description: 'Faster orbs',
            apply: () => undefined,
        };

        const damageCard = renderUpgradeCard(orbDamage, { player, base, rarity: 'common', increments: 1 });
        const speedCard = renderUpgradeCard(orbSpeed, { player, base, rarity: 'common', increments: 1 });

        expect(damageCard.querySelector('h3')?.textContent).toBe('Magic Orbs');
        expect(damageCard.querySelector('.unlockLine')?.textContent).toBe('Damage');
        expect(speedCard.querySelector('h3')?.textContent).toBe('Magic Orbs');
        expect(speedCard.querySelector('.unlockLine')?.textContent).toBe('Speed');
    });
});
