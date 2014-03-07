"use strict";

var _ = require('underscorem')
var seedrandom = require('seedrandom')

var binutil = require('binutil')

var HarrowBox = require('./harrowbox')

var editCodesModule = require('./editcodes')
var EditCodes = editCodesModule.Codes
var EditNames = editCodesModule.Names

var parseSchemas = require('./parse').parseSchemas

var generators = {}
function addGenerator(gen){
	generators[gen.name] = gen.func
}

var addOperations = require('./operations').addOperations

addGenerator(require('./properties/boolean'))
addGenerator(require('./properties/string'))
addGenerator(require('./properties/int32'))
addGenerator(require('./properties/float'))
addGenerator(require('./properties/timestamp'))
addGenerator(require('./properties/set'))
addGenerator(require('./properties/list'))
addGenerator(require('./properties/map'))
addGenerator(require('./properties/object'))
addGenerator(require('./properties/uuid'))

function generateProperty(propDef, classTypesByName, typeName){
	_.assertObject(propDef)
	//console.log('property def: ' + JSON.stringify(propDef))
	var gen = generators[propDef.type.type]
	var generated
	if(!gen){
		var type = classTypesByName[propDef.type.type]
		if(!type){
			throw new Error('cannot find property member type: ' + JSON.stringify(propDef.type) + ' in ' + typeName + ' ' + JSON.stringify(Object.keys(classTypesByName)))
		}
		generated = generators.object(propDef, generateProperty)
	}else{
		generated = gen(propDef, function(propDef){
			if(!propDef) throw new Error('missing propDef!')
			return generateProperty({type: propDef}, classTypesByName, typeName)
		})
	}
	_.assertFunction(generated)
	var res = {
		def: propDef,
		func: generated, 
		isObject: !gen,
		propertyName: propDef.name, 
		code: propDef.code, 
		isDefault: generated.isDefault, 
		serialize: generated.serialize,
		memberFunc: generated.memberFunc,
		memberSerialize: generated.memberSerialize,
		membersAreObjects: generated.membersAreObjects,
		getDefaultValue: generated.getDefaultValue,
		toJson: generated.toJson
	}
	if(propDef.type.type === 'map'){
		//console.log('map generated: ' + JSON.stringify(Object.keys(generated)))
		res.keySerialize = generated.keySerialize
		res.valueSerialize = generated.valueSerialize
		res.keyFunc = generated.keyFunc
		res.valueFunc = generated.valueFunc
	}
	return res
}

function generateClass(def, classTypesByName){

	var propPrototypes = []
	var propPrototypesByCode = {}
	var propPrototypesByName = {}
	var propDefsByName = {}
	def.properties.forEach(addProperty)
	
	function addProperty(prop){
		if(propPrototypesByCode[prop.code]){
			throw new Error('property collision: ' + prop.name + ' ' + propPrototypesByCode[prop.code].propertyName + ' on code ' + prop.code + ' for type ' + def.name)
			return
		}		
		var p = generateProperty(prop, classTypesByName, def.name)
		p.type = prop.type
		if(!prop.type) throw new Error(JSON.stringify(prop))
		propPrototypes.push(p)
		propPrototypesByCode[prop.code] = p
		propPrototypesByName[prop.name] = p
		propDefsByName[prop.name] = prop
	}
	
	var isLookup = {}
	isLookup[def.name] = true
	def.superTypes.forEach(function(superTypeName){
		isLookup[superTypeName] = true
		var superDef = classTypesByName[superTypeName]
		if(superDef){
			superDef.properties.forEach(addProperty)
		}else{
			console.log('WARNING, unknown superType: ' + superTypeName)
		}
	})

	var clazz = function(uuid){//just instantiate, don't populate (because we need all the stubs in the first pass, because it's a graph.)
		this._id = uuid
	}
	clazz.code = def.code
	clazz.prototype.type = def.name
	clazz.prototype.isa = function(name){
		//throw new Error('TODO')
		return isLookup[name]
	}
	clazz.prototype.id = function(){
		return seedrandom.uuidStringToBase64(this._id)
	}
	clazz.prototype.getBox = function(){
		return this._box
	}
	clazz.prototype._getCode = function(){
		return def.code
	}
	clazz.prototype._getPropertyPrototypesByCode = function(){
		return propPrototypesByCode
	}

	clazz.prototype.getBelongsTo = function(){
		return this.__belongsTo
	}
	clazz.prototype.getBelongsToProperty = function(){
		return this.__belongsToBy
	}
	
	clazz.prototype.each = function(propertyName, cb){
		var prop = propPrototypesByName[propertyName]
		if(prop.def.type.type !== 'map') throw new Error('cannot call each on non-map: ' + JSON.stringify(prop.def.type))
		
		var map = this[propertyName]
		var keys = Object.keys(map)
		for(var i=0;i<keys.length;++i){
			var key = keys[i]
			var value = map[key]
			cb(key, value)
		}
	}

	clazz.prototype.toJson = function(already){
		if(already && already[this.id()]) return 'ALREADY'
		var r = {}
		already = already || {}
		Object.keys(already).forEach(function(key){
			r[key] = already[key]
		})
		r[this.id()] = true
		
		var json = {}
		json.type = this.type
		for(var j=0;j<propPrototypes.length;++j){
			var pp = propPrototypes[j]
			if(!pp.toJson) throw new Error('missing toJson: ' + JSON.stringify(pp.def.type))
			var v = this[pp.propertyName]
			if(v){
				json[pp.propertyName] = pp.toJson(v, r)//v.toJson?v.toJson():v
			}
		}
		return json
	}
	clazz.prototype._instantiate = function(rs, objMap, w){

		this.w = w
		while(true){
			var code = rs.readByte()
			//console.log('code: ' + code)
			if(code === 0) break
			var pp = propPrototypesByCode[code]
			if(!pp){
				throw new Error('deserialization error, cannot find property with code: ' + code + ' for obj: ' + def.name)
			}
			this[pp.propertyName] = pp.func(rs, objMap, this)
		}
		//console.log('done first while')
		for(var j=0;j<propPrototypes.length;++j){
			var pp = propPrototypes[j]
			if(!this[pp.propertyName]){
				this[pp.propertyName] = pp.func()
			}
		}
	}
	clazz.prototype._serialize = function(w){
		for(var j=0;j<propPrototypes.length;++j){
			var pp = propPrototypes[j]
			var v = this[pp.propertyName]
			//console.log('serializing: ' + pp.propertyName + ' ' + propPrototypes.length + ' ' + j + ' ' + require('util').inspect(v))
			if(!pp.isDefault(v)){
				w.putByte(pp.code)
				//console.log('serialized property ' + pp.code + ' ' + pp.propertyName)
				pp.serialize(v, w)
			}
		}
		w.putByte(0)	
	}
	
	clazz.prototype._makeLike = function(json, w, makeCb){
		if(!w) console.log(new Error().stack)
		this.w = w
		
		
		for(var j=0;j<propPrototypes.length;++j){
			var pp = propPrototypes[j]
			var v = json[pp.propertyName]
			
			if(v && pp.isObject){
				if(v instanceof HarrowBox){
					v = v.root
				}
				if(!v._id || pp.def.type.inner){
					if(!v.type) throw new Error('no type given: ' + JSON.stringify(v))
					var n = makeCb(v.type, v)
					this[pp.propertyName] = n
				}else{					
					this[pp.propertyName] = v
				}
			}else if((pp.def.type.type === 'set' || pp.def.type.type === 'list') && pp.membersAreObjects){
				//console.log(require('util').inspect(pp))
				if(v){
					var n = []
					for(var i=0;i<v.length;++i){
						var cv = v[i]
						if(cv instanceof HarrowBox){
							cv = cv.root
						}
						if(!cv._id || pp.def.type.members.inner){
							cv = makeCb(cv.type, cv)
						}
						n.push(cv)
					}
					this[pp.propertyName] = n
				}
			}else if(v && (pp.def.type.type === 'map') && pp.membersAreObjects){
				throw new Error('TODO')
			}else{
				if(v !== undefined){
					this[pp.propertyName] = v
				}
			}
		}		
		
		w.beginUpdate()
		w.putByte(EditCodes.makeLike)
		w.putUuid(this._id)
		w._currentId = this._id

		this._serialize(w)
		
		w.endUpdate()
	}
	
	clazz.prototype._applyJson = function(json, makeCb){
		for(var j=0;j<propPrototypes.length;++j){
			var pp = propPrototypes[j]
			var v = json[pp.propertyName]
			
			if(v && pp.isObject){
				if(v instanceof HarrowBox){
					v = v.root
				}
				if(!v._id || pp.def.type.inner){
					if(!v.type) throw new Error('no type given: ' + JSON.stringify(v))
					var n = makeCb(v.type, v)
					this[pp.propertyName] = n
				}else{					
					this[pp.propertyName] = v
				}
			}else if((pp.def.type.type === 'set' || pp.def.type.type === 'list') && pp.membersAreObjects){
				//console.log(require('util').inspect(pp))
				var n = []
				if(v){
					for(var i=0;i<v.length;++i){
						var cv = v[i]
						if(cv instanceof HarrowBox){
							cv = cv.root
						}
						if(!cv._id || pp.def.type.members.inner){
							cv = makeCb(cv.type, cv)
						}
						n.push(cv)
					}
				}
				this[pp.propertyName] = n
			}else if(v && (pp.def.type.type === 'map') && pp.membersAreObjects){
				throw new Error('TODO')
			}else{
				if(v === undefined && pp.def.type.type === 'string'){
					this[pp.propertyName] = ''
				}else if(v === undefined && pp.def.type.type === 'map'){
					this[pp.propertyName] = {}
				}else{
					this[pp.propertyName] = v
				}
			}
		}	
	}
	
	clazz.prototype._instantiateNew = function(json, w, makeCb){
		if(!w) console.log(new Error().stack)
		this.w = w
		
		
		this._applyJson(json, makeCb)	
		
		w.beginUpdate()
		w.putByte(EditCodes.make)
		w.putUuid(this._id)
		w._currentId = this._id
		w.putInt(def.code)

		this._serialize(w)
		
		w.endUpdate()
	}
	
	clazz.prototype.toString = function(){
		var str = '{\n\tid: ' + this.id()
		//console.log('to stirng')
		for(var j=0;j<propPrototypes.length;++j){
			var pp = propPrototypes[j]
			var prop = propDefsByName[pp.propertyName]
			var v = this[pp.propertyName]
			//console.log(JSON.stringify(prop))
			if(prop.type.type === 'set' || prop.type.type === 'list'){
				v = v || pp.getDefaultValue()
				str += '\n\t' + pp.propertyName + ': ['// + (v.id || JSON.stringify())				
				for(var i=0;i<v.length;++i){
					if(i > 0) str += ', '
					var innerValue = v[i]
					str += innerValue._id?innerValue.type+':'+innerValue.id():innerValue
				}
				str += ']'
			}else{
				str += '\n\t' + pp.propertyName + ': ' + ((v?v._id:undefined) || JSON.stringify(v || pp.getDefaultValue()))
			}
		}
		//console.log('returning')
		return str + '\n}'
	}
	
	addOperations(clazz, propPrototypesByName)
	
	return clazz
}

function generateObjectClasses(objDefs, classes, classesByCode, classesByName){
	var classTypesByName = {}
	objDefs.forEach(function(def){
		classTypesByName[def.name] = def
	})
	objDefs.forEach(function(def){
		def.superTypes = getAllSuperTypes(def)
	})
	function getAllSuperTypes(def){
		var all = []
		var has = {}
		Object.keys(def.tags).forEach(function(tag){
			var st = classTypesByName[tag]
			if(st && !has[tag]){
				has[tag] = true
				//console.log('*adding: ' + tag)
				all.push(tag)
				var more = getAllSuperTypes(st)
				more.forEach(function(mt){
					if(!has[mt]){
						has[mt] = true
						//console.log('adding: ' + mt)
						all.push(mt)
					}
				})
			}
		})
		return all
	}
	objDefs.forEach(function(def){
		var clazz = generateClass(def, classTypesByName)
		classes[def.name] = clazz
		classesByCode[def.code] = clazz
		classesByName[def.name] = clazz
	})
}

function UpdateAggregator(classesByName, globalMetadataMaker){
	var dummyWs = {}
	var w = binutil.makeWriter(1024*64, dummyWs)
	w.delay()
	w.startCount()
	this.manyUpdates = 0
	
	var local = this
	function badMakeCb(){
		throw new Error('cannot nest objects in metadata')
	}
	w.beginUpdate = function(metadata){
		if(metadata || local.gmm){
			var globalMetadata = {}
			if(local.gmm){
				globalMetadata = local.gmm()
			}
		
			if(!globalMetadata){
				if(!metadata){
					w.putInt(0)
					return
				}else{
					globalMetadata = metadata
				}
			}else if(metadata){
				Object.keys(metadata).forEach(function(key){
					globalMetadata[key] = metadata[key]
				})
			}
		
			var clazz = classesByName[globalMetadata.type]
			if(!clazz) throw new Error('cannot find type: ' + globalMetadata.type)
			var obj = new clazz()
			
			obj.w = w
			obj._applyJson(globalMetadata, badMakeCb)	
			w.putInt(clazz.code)
			obj._serialize(w)
			//w.endUpdate()
		}else{
			w.putInt(0)
		}
	}
	w.endUpdate = function(){
		++local.manyUpdates
		if(local.onEdit){
			local.onEdit()
		}
		//console.log('got update, now holding ' + manyUpdates + ' updates, ' + w.getCurrentOffset() + ' bytes.') 
	}
	this.w = w
}
UpdateAggregator.prototype.setGlobalMetadataMaker = function(gmm){
	this.gmm = gmm
}
UpdateAggregator.prototype.takeUpdates = function(){
	if(this.manyUpdates === 0){
		//console.log('manyUpdates: ' + this.manyUpdates)
		return
	}
	var w = this.w
	//console.log('taking: ' + this.manyUpdates)
	w.countUp(this.manyUpdates)
	w.endCount()
	var b = w.copyBackingBuffer()
	w.cancel()
	w.delay()
	w.startCount()
	this.manyUpdates = 0
	return b
}

var dummyAgg = {
}

exports.EditNames = EditNames
exports.EditCodes = EditCodes
exports.make = function(schemaOrSchemas){
	_.assertDefined(schemaOrSchemas)
	var schemas
	if(_.isArray(schemaOrSchemas)) schemas = schemaOrSchemas
	else schemas = [schemaOrSchemas]

	var objDefs = parseSchemas(schemas)

	var classes = {}
	var classesByCode = {}
	var classesByName = {}
	generateObjectClasses(objDefs, classes, classesByCode, classesByName)

	function deserialize(buf, w){
		var rs = binutil.makeReader()//rsModule.make()
		rs.put(buf)
		var r = rs.s
		/*console.log('buf: ' + buf + ' ' + buf.constructor.name)
		for(var i=0;i<buf.length;++i){
			console.log(buf[i])
		}*/
		//var lastVersionId = r.readInt()
		//console.log('lastVersionId: ' + lastVersionId)
		var manyObjects = r.readInt()
	//	console.log('manyObjects: ' + manyObjects)
		var objMap = {}
		var objList = []
		for(var i=0;i<manyObjects;++i){
			var objCode = r.readInt()
			var objId = r.readUuid()
			var manyEdits = r.readInt()
			
			var clazz = classesByCode[objCode]
			if(!clazz){
				throw new Error('cannot find clazz for code: ' + objCode)
			}
			var obj = new clazz(objId)
			obj.manyEdits = manyEdits
			//console.log('will deserialize ' + objCode + ' ' + obj.type + ' ' + objId)
			objMap[objId] = obj
			objList.push(obj)
		}
		//console.log('manyObjects: ' + manyObjects)
		for(var i=0;i<manyObjects;++i){
			var obj = objList[i]
			//console.log('instantiating ' + i + ' ' + obj._id)
			obj._instantiate(r, objMap, w)
		}
		/*var manyAppendedUpdates = r.readInt()
		var updates = []
		console.log('appended: ' + manyAppendedUpdates)
		for(var i=0;i<manyAppendedUpdates;++i){
			var sequenceId = r.readInt()
			var updateBuf = r.readVarData()
			console.log(sequenceId + ' -> ' + updateBuf.length)
			updates.push({sequenceId: sequenceId, data: updateBuf})
		}*/
		//console.log('returning')
		return {
			objList: objList,
			objMap: objMap
		}
	}

	function parse(buf){
		//console.log('parsing: ' + buf.length)
		var data = deserialize(buf)
		return data.objList[0]
	}
	var dummyWs = {}
	function serialize(w, box){
		box._serialize(w)
	}
	function instantiate(buf){
		var agg = new UpdateAggregator(classesByName)
		var data = deserialize(buf, agg.w)
		
		var hb = new HarrowBox(undefined, data, classesByName, classesByCode, agg)
		return hb
	}
	function instantiateNew(config){
		var agg = new UpdateAggregator(classesByName)
		var hb = new HarrowBox(config, undefined, classesByName, classesByCode, agg)
		return hb
	}

	function replayUpdate(hb, update, cb){//, returnMerged){
		//var data = deserialize(value)
		//var hb = new HarrowBox(undefined, data, classesByName, classesByCode, dummyAgg)		
		
		try{
			hb.applyUpdatesAndCb([update], cb)
		}catch(e){
			console.log('ERROR: ' + e.stack)
			return
		}
		return hb
		
		/*if(returnMerged){
			var w = binutil.makeWriter(1024*64, dummyWs)
			w.delay()
			hb._serialize(w)
		
			var b = w.getBackingBuffer().slice(0, w.getCurrentOffset())
			return b
		}*/
	}
	
	function merge(stateBuf, updates){
		//_.assertBuffer(stateBuf)
		//_.assertArray(updates)

		var data = deserialize(stateBuf)
		var hb = new HarrowBox(undefined, data, classesByName, classesByCode, dummyAgg)

		try{
			var broken = hb.applyUpdates(updates)
		}catch(e){
			console.log('ERROR: ' + e.stack)
			return
		}

		var w = binutil.makeWriter(1024*64, dummyWs)
		w.delay()
		hb._serialize(w)
		
		var b = w.getBackingBuffer().slice(0, w.getCurrentOffset())
		b.broken = broken
		return b
		
		//TODO optimize:
		//1. scan updates, determine which objects are objected
		//2. copy over without parsing all objects in stateBuf which are not updated, instantiate the rest
		//3. apply updates in-place to instantiated objects using the same logic as live updates
	}
	
	
	return {
		serialize: serialize,//serializes box
		parse: parse,//parses to static
		instantiate: instantiate,//parses to editable
		instantiateNew: instantiateNew,
		merge: merge,
		replayUpdate: replayUpdate
	}	
}
