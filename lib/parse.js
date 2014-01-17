function convertTags(tagTokens){
	var tags = {}
	tagTokens.forEach(function(tag){
		tags[tag] = true
	})
	return tags
}

function applyCollectionType(type, str){
	if(type.type === 'set' || type.type === 'list'){
		type.members = parsePropertyType(str)
	}else{
		var tokens = str.split(',')
		type.key = parsePropertyType(tokens[0])
		type.value = parsePropertyType(tokens[1])
	}
}

function parsePropertyType(typeStr){
	var startArrow = typeStr.indexOf('<')
	if(startArrow === -1){
		var type = {type: typeStr}
		if(typeStr.indexOf('local:') === 0){
			type.type = typeStr.substr('local:'.length)
			type.inner = true
		}
		return type
	}else{
		var typeName = typeStr.substr(0, startArrow)
		var type = {type: typeName}
		applyCollectionType(type, typeStr.substring(startArrow+1,typeStr.length-1))
		return type
	}
}

function parseSchemas(schemas){
	var objs = []
	var objCodeTaken = {}
	schemas.forEach(function(schema){
		var objectKeys = Object.keys(schema)
		objectKeys.forEach(function(objKey){
			var objTokens = objKey.split(' ')
			var objCode = parseInt(objTokens[1])
			var objName = objTokens[0]

			if(objCode <= 0) throw new Error('obj code must be greater than zero: ' + objKey)
			
			var properties = []
			var props = schema[objKey]
			Object.keys(props).forEach(function(propName){
				var propValue = props[propName]
				var tokens = propValue.split(' ')
				var propType = tokens[0]
				var propCode = parseInt(tokens[1])
				if(propCode <= 0) throw new Error('property code must be greater than zero: ' + JSON.stringify([propName, propValue]))
				properties.push({
					code: propCode,
					name: propName,
					type: parsePropertyType(propType),
					tags: convertTags(tokens.slice(2))
				})
			})
			
			if(objCodeTaken[objCode]) throw new Error('object code collision: ' + objName + ' ' + objCode)
			objCodeTaken[objCode] = true
			
			var objDef = {
				code: objCode,
				name: objName,
				tags: convertTags(objTokens.slice(2)),
				properties: properties
			}
			//console.log('objdef: ' + JSON.stringify(objDef))
			objs.push(objDef)
		})
	})
	return objs
}

exports.parseSchemas = parseSchemas
