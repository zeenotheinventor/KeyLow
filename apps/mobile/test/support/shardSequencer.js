// Jest loads a custom test sequencer as plain CommonJS, outside Babel, so it has to use require().
/* eslint-disable @typescript-eslint/no-require-imports */
const { statSync } = require("node:fs");

const Sequencer = require("@jest/test-sequencer").default;

// Jest's own --shard gives each leg the files whose path hashes into its slice, so the legs differ a
// lot in cost. File size tracks a mobile test file's time well enough, so this puts the files, largest
// first, into the lightest leg so far. A tie in size goes by path and a tie in weight by the lower leg
// number, so every leg works out the same split. The order inside a leg stays Jest's own sort.
class ShardSequencer extends Sequencer {
  shard(tests, { shardIndex, shardCount }) {
    const bySizeThenPath = tests
      .map((test) => ({ test, size: statSync(test.path).size }))
      .sort((a, b) => b.size - a.size || (a.test.path < b.test.path ? -1 : 1));
    const legs = Array.from({ length: shardCount }, () => ({ size: 0, tests: [] }));
    for (const { test, size } of bySizeThenPath) {
      const lightest = legs.reduce((best, leg) => (leg.size < best.size ? leg : best));
      lightest.size += size;
      lightest.tests.push(test);
    }
    return legs[shardIndex - 1].tests;
  }
}

module.exports = ShardSequencer;
