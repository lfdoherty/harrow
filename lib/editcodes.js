var EditCodes = {
	make: 1,
	copy: 2,
	add: 3,
	put: 4,
	set: 5,
	unshift: 6,
	toggle: 7,
	remove: 8,
	makeLike: 9,
	clear: 10,
	insert: 11
}

exports.Codes = EditCodes

var EditNames = {}
Object.keys(EditCodes).forEach(function(name){
	EditNames[EditCodes[name]] = name
})

exports.Names = EditNames
