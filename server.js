require('@babel/register')();

process.env.ROOT_PATH = __dirname;
const { NODE_ENV } = process.env;

require.extensions['.scss'] = function scss() {};
require.extensions['.css'] = function css() {};

if (NODE_ENV == 'production') {
  require('./prod/app/server.js');
} else {
  require('./app/server.js');
}
