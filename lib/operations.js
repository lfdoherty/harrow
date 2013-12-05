
var EditCodes = require('./editcodes').Codes

exports.addOperations = function(clazz, propPrototypesByName){
	clazz.prototype.__setupProperty = function(propertyName, editCode, metadata){
		var pp = propPrototypesByName[propertyName]
		if(!pp){
			throw new Error('cannot find property ' + propertyName + ' for class ' + clazz.prototype.type)
		}
		
		//TODO check validity of edit given property type
		
		if(this[propertyName] == undefined) this[propertyName] = pp.getDefaultValue()

		this.w.beginUpdate(metadata)
		this.w.putByte(editCode)
		if(this.w._currentId !== this._id){
			this.w._currentId = this._id
			this.w.putBoolean(true)
			this.w.putUuid(this._id)
			//console.log('wrote id')
		}else{
			this.w.putBoolean(false)
			console.log('skipped id')
		}
		this.w.putByte(pp.code)
		
		++this.manyEdits
		
		return pp
	}
	clazz.prototype.copy = function(json){
		return this._box._copy(this, json)
	}
	
	//LISTS/SETS
	clazz.prototype.add = function(propertyName, value, metadata){
		if(this[propertyName] && this[propertyName].indexOf(value) !== -1){
			console.log('WARNING: set/list already contains, so did not add: ' + value)
			return
		}
		
		var pp = this.__setupProperty(propertyName, EditCodes.add, metadata)
		this[propertyName].push(value)
		pp.memberSerialize(value, this.w)		
		this.w.endUpdate()
	}
	clazz.prototype.remove = function(propertyName, value, metadata){
		var arr = this[propertyName]
		if(!arr || arr.indexOf(value) === -1){
			console.log('WARNING: does not contain, so cannot remove: ' + value)
			return
		}
		
		var pp = this.__setupProperty(propertyName, EditCodes.remove, metadata)
		arr.splice(arr.indexOf(value), 1)
		pp.memberSerialize(value, this.w)		
		this.w.endUpdate()
	}

	//MAPS
	clazz.prototype.put = function(propertyName, key, value, metadata){
		var pp = this.__setupProperty(propertyName, EditCodes.put, metadata)
		this[propertyName][key.id?key.id():key] = value
		pp.keySerialize(key, this.w)
		pp.valueSerialize(value, this.w)
		this.w.endUpdate()
	}
	clazz.prototype.toggle = function(propertyName, key, metadata){
		var pp = this.__setupProperty(propertyName, EditCodes.toggle, metadata)
		if(pp.type.type === 'boolean'){
			this[propertyName] = !this[propertyName]
		}else{
			this[propertyName][key] = !this[propertyName][key]
			pp.keySerialize(key, this.w)
		}
		this.w.endUpdate()
	}
	
	//LISTS
	clazz.prototype.unshift = function(propertyName, value, metadata){
		if(this[propertyName] && this[propertyName].indexOf(value) !== -1){
			console.log('WARNING: set/list already contains, so did not unshift: ' + value)
			return
		}
		
		var pp = this.__setupProperty(propertyName, EditCodes.unshift, metadata)
		this[propertyName].unshift(value)
		pp.memberSerialize(value, this.w)		
		this.w.endUpdate()
	}

	clazz.prototype.clear = function(propertyName, metadata){
		var pp = this.__setupProperty(propertyName, EditCodes.clear, metadata)
		this[propertyName] = pp.getDefaultValue()
		this.w.endUpdate()
	}

	clazz.prototype.set = function(propertyName, value, metadata){
		if(this[propertyName] === value) return
		
		var pp = this.__setupProperty(propertyName, EditCodes.set, metadata)
		var old = this[propertyName]
		this[propertyName] = value
		if(pp.type.type === 'string'){
			if(old){
				var d = value.length - old.length
				if(d > 0){
					if(old === value.substr(0, old.length)){
						this.w.putByte(2)//append
						pp.serialize(value.substr(old.length), this.w)
						this.w.endUpdate()
						return
					}else if(old === value.substr(d)){
						this.w.putByte(3)//prepend
						pp.serialize(value.substr(0,d), this.w)
						this.w.endUpdate()
						return
					}else if(d === 1){
						var diffIndex
						var vi = 0
						var moreThanOne = false
						for(var i=0;i<old.length;++i,++vi){
							if(value[vi] !== old[i]){
								if(diffIndex !== undefined){
									moreThanOne = true
									break
								}
								diffIndex = i
								--i
							}
						}
						if(!moreThanOne){
							if(diffIndex === undefined){
								throw new Error('this makes no sense')
							}
							this.w.putByte(6)//insert one character
							pp.serialize(value[diffIndex], this.w)
							this.w.putVarUint(diffIndex)
							this.w.endUpdate()
							return
						}
					}else{
						//TODO
					}
				}else if(d < 0){
					//TODO
					if(value === old.substr(0, value.length)){
						this.w.putByte(4)//truncate
						pp.serialize(old.substr(value.length), this.w)
						this.w.endUpdate()
						return
					}else if(value === old.substr(d)){
						this.w.putByte(5)//pre-truncate
						pp.serialize(old.substr(0,d), this.w)
						this.w.endUpdate()
						return
					}else if(d === -1){
						var diffIndex
						var vi = 0
						var moreThanOne = false
						for(var i=0;i<value.length;++i,++vi){
							if(value[i] !== old[vi]){
								if(diffIndex !== undefined){
									moreThanOne = true
									break
								}
								diffIndex = i
								--i
							}
						}
						if(!moreThanOne){
							if(diffIndex === undefined){
								throw new Error('this makes no sense')
							}
							this.w.putByte(7)//remove one character
							pp.serialize(value[diffIndex], this.w)
							this.w.putVarUint(diffIndex)
							this.w.endUpdate()
							return
						}
					}else{
						//TODO
					}
				}
			}
			this.w.putByte(1)
		}
		pp.serialize(value, this.w)
		this.w.endUpdate()
	}
	
	
}
