module.exports = {
	entry: './lib/main.js',
	output: {
    filename: './dist/react-draggable.js',
    sourceMapFilename: './dist/react-draggable.map',
    library: 'Draggable',
    libraryTarget: 'umd'
	},
  externals: {
    'react/addons': 'React'
  },
	module: {
		loaders: [
			{test: /\.js$/, loader: 'jsx-loader'}
		]
	}
};
