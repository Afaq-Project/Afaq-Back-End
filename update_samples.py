import json

def update_samples(filename):
    with open(filename, 'r') as f:
        data = json.load(f)
    
    for folder in data.get('item', []):
        if folder.get('name') == 'Profile':
            for req in folder.get('item', []):
                if req.get('name') == 'Update Personal Info':
                    req['request']['body']['raw'] = json.dumps({
                        "firstName": "John",
                        "lastName": "Doe",
                        "email": "john.doe@example.com",
                        "dateOfBirth": "1995-08-15",
                        "gender": "MALE",
                        "maritalStatusId": "UUID-HERE",
                        "phone": "+970599000000",
                        "bio": "Software Engineer with 5 years of experience.",
                        "profilePhotoUrl": "https://example.com/photo.jpg",
                        "experiences": [
                            "Senior Developer at Tech Corp (2020-Present)",
                            "Junior Developer at Startup Inc (2018-2020)"
                        ],
                        "countryOfResidenceId": "UUID-HERE",
                        "nationalityId": "UUID-HERE",
                        "currentCityId": "UUID-HERE",
                        "educationLevelId": "UUID-HERE"
                    }, indent=4)
                elif req.get('name') == 'Create Education':
                    req['request']['body']['raw'] = json.dumps({
                        "institutionId": "UUID-HERE",
                        "majorId": "UUID-HERE",
                        "educationLevelId": "UUID-HERE",
                        "minorMajorId": "UUID-HERE",
                        "startDate": "2018-09-01",
                        "endDate": "2022-06-15",
                        "expectedGraduationDate": None,
                        "isCurrent": False,
                        "gpaRaw": 3.8,
                        "gpaScale": "OUT_OF_4"
                    }, indent=4)
                elif req.get('name') == 'Update Education':
                    req['request']['body']['raw'] = json.dumps({
                        "gpaRaw": 3.9,
                        "isCurrent": True,
                        "endDate": None,
                        "expectedGraduationDate": "2025-06-30"
                    }, indent=4)

    with open(filename, 'w') as f:
        json.dump(data, f, indent=4)

update_samples('Levora_API.postman_collection.json')
update_samples('Levora_API_localhost.postman_collection.json')
