
var _ = require('underscorem')
var seedrandom = require('seedrandom')

var HarrowBox = require('./../harrowbox')

exports.name = 'object'
exports.func = function(){
	return makeObjectRef
}

function makeObjectRef(rs, objMap){
	if(rs){
		_.assertObject(objMap)
		var uuid = rs.readUuid()
		//console.log('uuid: ' + uuid)
		var obj = objMap[uuid]
		if(!obj){
			throw new Error('load error, cannot find object with uuid: ' + uuid)
		}
		return obj
	}
}

makeObjectRef.toJson = function(v, already){
	return v.toJson(already)
}

makeObjectRef.serialize = function(v, w){
	if(v instanceof HarrowBox){
		v = v.root
	}
	if(typeof(v) === 'string'){
		w.putUuid(seedrandom.uuidBase64ToString(v))
		return
	}
	if(!v._id){
		throw new Error('invalid object property value has no id: ' + Object.keys(v))
	}

	if(!v._id) throw new Error('no id: ' + JSON.stringify(v))
	w.putUuid(v._id)
	return v
}

makeObjectRef.isDefault = function(v){
	return v==undefined
}

makeObjectRef.getDefaultValue = function(){
	return undefined
}
