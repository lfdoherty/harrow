
var harrow = require('./lib/main')
var bufw = require('./lib/bufw')

var schema = {
	'term 1': {
		name: 'string 1',
		text: 'string 2',
		linked: 'set<term> 3'
	}
}

var h = harrow.make(schema)

var start = Date.now()

var whaleTermBox = h.instantiateNew({type: 'term', name: 'Whale', text: 'Large mammals that live in the ocean.'})//, agg.w)
for(var i=0;i<1000*10;++i){
	var dolphin = whaleTermBox.make('term', {name: 'Dolphin', text: 'Like a whale but different.', linked: [whaleTermBox]})
	var porpoise = whaleTermBox.make('term', {name: 'Porpoise', text: 'What is the purpose of a porpoise?'})
	dolphin.add('linked', porpoise)
	whaleTermBox.root.add('linked', dolphin)
}

var setup = Date.now()
console.log('setup took: ' + (setup - start) + ' ms.')
//

console.log('serializing...')
var buf = h.serialize(whaleTermBox)

var serialized = Date.now()
console.log('serializing took: ' + (serialized - setup) + ' ms.')
console.log('serialized: ' + buf.length + ' bytes.')

var staticBox = h.parse(buf)

var parsed = Date.now()
console.log('parsing took: ' + (parsed - serialized) + ' ms.')

console.log('total elapsed: ' + (Date.now() - start) + ' ms.')

console.log('\n\ntesting updating...')

var secondWhaleTermBox = h.instantiate(buf)
for(var i=0;i<1000*100;++i){
	var dolphin = secondWhaleTermBox.make('term', {name: 'Dolphin', text: 'Like a whale but different.', linked: [secondWhaleTermBox]})
	var porpoise = secondWhaleTermBox.make('term', {name: 'Porpoise', text: 'What is the purpose of a porpoise?'})
	dolphin.add('linked', porpoise)
	secondWhaleTermBox.root.add('linked', dolphin)
}
