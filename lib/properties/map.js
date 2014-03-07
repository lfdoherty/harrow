
exports.name = 'map'
exports.func = function(def, genCb){
	return makeMapGenerator(def, genCb)
}

function makeMapGenerator(def, genCb){
	var makeKey = genCb(def.type.key)
	var makeValue = genCb(def.type.value)
	function makeMap(rs, objMap){
		if(rs){
			var many = rs.readInt()
			var m = {}
			for(var i=0;i<many;++i){
				var key = makeKey.func(rs, objMap)
				var value = makeValue.func(rs, objMap)
				if(key.id){
					m[key.id()] = value
				}else{
					m[key] = value
				}
			}
			return m
		}else{
			return {}
		}
	}
	
	makeMap.toJson = function(v, already){
		var res = {}
		if(v){
			Object.keys(v).forEach(function(key){
				var value = v[key]
				res[key] = makeValue.toJson(value, JSON.parse(JSON.stringify(already)))
			})
		}
		return res
	}
	
	makeMap.serialize = function(v, w, makeCb){
		var keys = Object.keys(v)
		w.putInt(keys.length)
		for(var i=0;i<keys.length;++i){
			var key = keys[i]
			makeKey.serialize(key, w, makeCb)
			var value = v[key]
			makeValue.serialize(value, w, makeCb)
		}
	}
	makeMap.keyFunc = makeKey.func
	makeMap.valueFunc = makeValue.func
	makeMap.keySerialize = makeKey.serialize
	makeMap.valueSerialize = makeValue.serialize

	makeMap.isDefault = function(v){
		return v==undefined||Object.keys(v).length === 0
	}
	
	makeMap.getDefaultValue = function(){
		return {}
	}
	
	return makeMap
}
