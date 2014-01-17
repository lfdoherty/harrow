
var _ = require('underscorem')
var seedrandom = require('seedrandom')
var binutil = require('binutil')

var EditCodes = require('./editcodes').Codes


function HarrowBox(config, data, classesByName, classesByCode, agg){

	this.agg = agg
	var w = this.w = agg.w
	this.classesByName = classesByName
	this.classesByCode = classesByCode

	if(config){
		var clazz = classesByName[config.type]
		var uuid = seedrandom.uid()
		this.root = new clazz(uuid)
		this.root._box = this
		
		w.beginUpdate()
		var local = this

		this.objList = [this.root]
		this.objs = {}
		this.objs[uuid] = this.root

		function makeCb(typeName, json){
			return local.make(typeName, json, makeCb)
		}
		this.root._instantiateNew(config, w, makeCb)

		w.endUpdate()

	}else{
		this.originalData = data.fullBuffer
		this.root = data.objList[0]
		this.objList = data.objList
		this.objs = data.objMap
		
		for(var i=0;i<data.objList.length;++i){
			var obj = data.objList[i]
			obj._box = this
		}
		//console.log('applying deserialized updates: ' + data.updates.length)
		//this.applyUpdates(data.updates)
	}
	
	var editListeners = this.editListeners = []	
	var beforeEditListeners = this.beforeEditListeners = []
	agg.onEdit = function(){
		for(var i=0;i<editListeners.length;++i){
			var listener = editListeners[i]
			listener()
		}
	}
	agg.beforeEdit = function(){
		for(var i=0;i<beforeEditListeners.length;++i){
			var listener = beforeEditListeners[i]
			listener()
		}
	}
}
HarrowBox.prototype.getById = function(id){
	id = seedrandom.uuidBase64ToString(id)
	var obj = this.objs[id]
	if(!obj) throw new Error('unknown id: ' + id)
	return obj
}

HarrowBox.prototype.onEdit = function(listener){
	this.editListeners.push(listener)
}
HarrowBox.prototype.beforeEdit = function(listener){
	this.beforeEditListeners.push(listener)
}
HarrowBox.prototype.afterEdit = function(listener){
	this.editListeners.push(listener)
}
HarrowBox.prototype.getRoot = function(){
	return this.root
}

HarrowBox.prototype.takeUpdates = function(){
	this.w._currentId = undefined
	return this.agg.takeUpdates()
}

HarrowBox.prototype.makeLike = function(obj, json){
	var local = this
	obj._makeLike(json, this.w, function(typeName, json){
		return local.make(typeName, json)
	})
	return obj
}

HarrowBox.prototype.make = function(typeName, json){
	var clazz = this.classesByName[typeName]
	if(!clazz){
		throw new Error('cannot find object type: ' + typeName)
	}
	var uuid = seedrandom.uid()
	var obj = new clazz(uuid)
	obj._box = this
	var local = this
	obj._instantiateNew(json, this.w, function(typeName, json){
		return local.make(typeName, json)
	})
	obj.manyEdits = 0
	this.objs[uuid] = obj
	this.objList.push(obj)
	return obj
}

function copyUnder(dest, src){
	if(typeof(dest) === 'object'){
		if(dest._id) return dest
		var realDest = {}
		Object.keys(dest).forEach(function(key){
			var sv = src?src[key]:undefined
			realDest[key] = copyUnder(dest[key], sv)
		})
		if(src){
			Object.keys(src).forEach(function(key){
				var v = src[key]
				if(realDest[key] === undefined){
					realDest[key] = v
				}
			})
		}
		return realDest
	}
	return dest
}

HarrowBox.prototype.setGlobalMetadataMaker = function(gmm){
	this.agg.setGlobalMetadataMaker(gmm)
}

HarrowBox.prototype._copy = function(obj, json){
	//throw new Error('TODO')
	var typeName = obj.type
	var clazz = this.classesByName[typeName]
	if(!clazz){
		throw new Error('cannot find object type: ' + typeName)
	}

	var newJson 
	if(json){
		//newJson = JSON.parse(JSON.stringify(json))
		newJson = copyUnder(json, obj)
	}else{
		newJson = copyUnder({}, obj)
	}
	
	var uuid = seedrandom.uid()
	var newObj = new clazz(uuid)
	newObj._box = this
	var local = this
	newObj._instantiateNew(newJson, this.w, function(typeName, json){
		return local.make(typeName, json)
	})
	newObj.manyEdits = 0
	this.objs[uuid] = newObj
	this.objList.push(newObj)
	return newObj
}

HarrowBox.prototype._serialize = function(w){
	//w.putInt(this.__lastVersionId)
	w.putInt(this.objList.length)
	for(var i=0;i<this.objList.length;++i){
		var obj = this.objList[i]
		w.putInt(obj._getCode())
		if(!obj._id) throw new Error('no _id')
		w.putUuid(obj._id)
		w.putInt(obj.manyEdits||0)
	}
	for(var i=0;i<this.objList.length;++i){
		var obj = this.objList[i]
	//	console.log('serializing object ' + i + '/' + this.objList.length)
		obj._serialize(w)
	}
}

HarrowBox.prototype.size = function(){
	return this.objList.length
}

HarrowBox.prototype.applyUpdatesAndCb = function(updates, cb){

	var broken = false
	function registerError(err){
		console.log('WARNING: updating error: ' + err)
		broken = true
	}

	try{
	
		for(var j=0;j<updates.length&&!broken;++j){
	

			var rs = binutil.makeReader()
			rs.put(updates[j])
			var r = rs.s
	
			var manyEdits = r.readInt()
			//console.log('applying edits: ' + manyEdits)
			var id
			for(var i=0;i<manyEdits;++i){
				//var timestamp = r.readLong()
			
				var metadataType = r.readInt()
				var metadata
				if(metadataType !== 0){
					var clazz = this.classesByCode[metadataType]				
					metadata = new clazz(id)
					var tempObjMap = {}
					metadata._instantiate(r, tempObjMap, this.w)
				}
			
				//console.log('time: ' + new Date(timestamp) + ' ' + timestamp)
				var editCode = r.readByte()
				//console.log('editCode: ' + editCode)
				if(editCode === EditCodes.make){
					id = r.readUuid()
					var typeCode = r.readInt()
					var clazz = this.classesByCode[typeCode]
				
					if(!clazz){
						console.log('id: ' + id)
						throw new Error('cannot find class for type code: ' + typeCode)
					}

					var obj = new clazz(id)
					obj._box = this
					obj._instantiate(r, this.objs, this.w)
					this.objs[id] = obj
					this.objList.push(obj)

					cb(metadata, this, editCode, obj)
					//console.log('obj made: ' + id)
				}else if(editCode === EditCodes.makeLike){
					id = r.readUuid()
					//console.log('id: ' + id)
					var obj = this.objs[id]
					if(!obj) throw new Error('cannot find object to makeLike: ' + id + ' ' + JSON.stringify(Object.keys(this.objs)))
				
					obj._instantiate(r, this.objs, this.w)
					cb(metadata, this, editCode, obj)
				}else{
					if(r.readBoolean()){
						id = r.readUuid()
						//console.log('reading id')
					}
					var propertyCode = r.readByte()
					var obj = this.objs[id]
					if(!obj){
						//throw new Error('object not found: ' + id)
						registerError('object not found: ' + id)
						break
					}
					++obj.manyEdits
					var propsByCode = obj._getPropertyPrototypesByCode()
					var pp = propsByCode[propertyCode]
					if(!pp){
						console.log('WARNING: cannot find property for code: ' + propertyCode + ' for ' + obj.type)
						continue
					}
					if(editCode === EditCodes.add){
						var member = pp.memberFunc(r, this.objs)
						if(obj[pp.propertyName].indexOf(member) !== -1){
							console.log('skipping adding value already a member of list/set: ' + member._id)
							continue
						}
						if(pp.def.inner){
							member.__belongsTo = obj
							member.__belongsToBy = propertyName
						}
						obj[pp.propertyName].push(member)
						cb(metadata, obj, editCode, pp.propertyName, member)
						//console.log('obj added to collection: ' + member.id())
					}else if(editCode === EditCodes.remove){
						var member = pp.memberFunc(r, this.objs)
						var arr = obj[pp.propertyName]
						var index = arr.indexOf(member)
						if(index === -1){
							console.log('skipping remove value not in list/set: ' + member._id)
							continue
						}
						arr.splice(index, 1)
						cb(metadata, obj, editCode, pp.propertyName, member)
					}else if(editCode === EditCodes.unshift){
						var member = pp.memberFunc(r, this.objs)
						obj[pp.propertyName].unshift(member)
						cb(metadata, obj, editCode, pp.propertyName, member)
					}else if(editCode === EditCodes.put){
						var key = pp.keyFunc(r, this.objs)
						var value = pp.valueFunc(r, this.objs)
						if(key.id) key = key.id()
						obj[pp.propertyName][key] = value
						cb(metadata, obj, editCode, pp.propertyName, key, value)
					}else if(editCode === EditCodes.toggle){
						if(pp.type.type === 'boolean'){
							obj[pp.propertyName] = !obj[pp.propertyName]
							cb(metadata, obj, editCode, pp.propertyName, obj[pp.propertyName])
						}else{
							var key = pp.keyFunc(r, this.objs)
							obj[pp.propertyName][key] = !obj[pp.propertyName][key]
							cb(metadata, obj, editCode, pp.propertyName, key, obj[pp.propertyName][key])
						}
					}else if(editCode === EditCodes.clear){
						obj[pp.propertyName] = pp.func()
						cb(metadata, obj, editCode, pp.propertyName)
					}else if(editCode === EditCodes.set){
						var old = obj[pp.propertyName]
						if(pp.type.type === 'string'){
							var type = r.readByte()
							//console.log('type: ' + type)
							//console.log('value: ' + value)
							if(type !== 1){
								var value = pp.func(r, this.objs)
								if(type === 2){//append
									obj[pp.propertyName] += value
									cb(metadata, obj, editCode, pp.propertyName, obj[pp.propertyName], old, 'append', value)
								}else if(type === 3){//prepend
									obj[pp.propertyName] = value + obj[pp.propertyName]
									cb(metadata, obj, editCode, pp.propertyName, obj[pp.propertyName], old, 'prepend', value)
								}else if(type === 4){//truncate
									var old = obj[pp.propertyName]
									obj[pp.propertyName] = old.substr(0, old.length-value.length)
									cb(metadata, obj, editCode, pp.propertyName, obj[pp.propertyName], old, 'truncate', value)
								}else if(type === 5){//pre-truncate
									var old = obj[pp.propertyName]
									obj[pp.propertyName] = old.substr(value.length)
									cb(metadata, obj, editCode, pp.propertyName, obj[pp.propertyName], old, 'pretruncate', value)
								}else if(type === 6){//insert
									var pos = r.readVarUint()
									var old = obj[pp.propertyName]
									obj[pp.propertyName] = old.substr(0,pos) + value + old.substr(pos)
									cb(metadata, obj, editCode, pp.propertyName, obj[pp.propertyName], old, 'insert', value, pos)
								}else if(type === 7){//remove
									var pos = r.readVarUint()
									var old = obj[pp.propertyName]
									obj[pp.propertyName] = old.substr(0,pos) + old.substr(pos+value.length)
									cb(metadata, obj, editCode, pp.propertyName, obj[pp.propertyName], old, 'remove', value, pos)
								}else{
									//throw new Error('unknown string set variant: ' + type)
									registerError('unknown string set variant: ' + type)
									break
								}
								continue
							}
						}
						var value = pp.func(r, this.objs)
						obj[pp.propertyName] = value
						cb(metadata, obj, editCode, pp.propertyName, value, old)
					}else{
						//throw new Error()
						registerError('unrecognized edit code: ' + editCode)
						break
					}
				}
			}
		}
	}catch(e){
		console.log('error: ' + e)
		return true
	}
	return broken
}

function stub(){}

HarrowBox.prototype.applyUpdates = function(updates, report){
	if(report){
		for(var i=0;i<this.beforeEditListeners.length;++i){
			var listener = this.beforeEditListeners[i]
			listener(true)
		}
	}
	var broken = this.applyUpdatesAndCb(updates, stub)
	if(report){
		for(var i=0;i<this.editListeners.length;++i){
			var listener = this.editListeners[i]
			listener(true)
		}
	}
	return broken
}

module.exports = HarrowBox
