module.exports = {
  apps: [{
    name: 'gom-homework',
    script: 'src/index.ts',
    interpreter: 'node',
    interpreter_args: '--experimental-strip-types',
    watch: false,
    env: {
      NODE_ENV: 'production',
    },
  }],
};
