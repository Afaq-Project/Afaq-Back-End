import json

def process(filename):
    with open(filename, 'r') as f:
        data = json.load(f)
    
    auth_items = []
    health_items = []
    
    for folder in data.get('item', []):
        if folder.get('name') == 'Auth':
            auth_items = folder.get('item', [])
        elif folder.get('name') == 'Health':
            health_items = folder.get('item', [])

    # We rebuild the items
    new_items = []
    
    # Auth
    if auth_items:
        new_items.append({"name": "Auth", "item": auth_items})
    
    # Profile
    profile_item = {
        "name": "Profile",
        "item": [
            {
                "name": "Get My Profile",
                "request": {
                    "method": "GET",
                    "header": [{"key": "Authorization", "value": "Bearer {{access_token}}", "type": "text"}],
                    "url": {"raw": "{{base_url}}/api/v1/profile/me", "host": ["{{base_url}}"], "path": ["api", "v1", "profile", "me"]}
                }
            },
            {
                "name": "Update Personal Info",
                "request": {
                    "method": "PATCH",
                    "header": [{"key": "Authorization", "value": "Bearer {{access_token}}", "type": "text"}],
                    "body": {"mode": "raw", "raw": "{\n    \"firstName\": \"Updated Name\",\n    \"bio\": \"New bio\"\n}", "options": {"raw": {"language": "json"}}},
                    "url": {"raw": "{{base_url}}/api/v1/profile/personal", "host": ["{{base_url}}"], "path": ["api", "v1", "profile", "personal"]}
                }
            },
            {
                "name": "Create Education",
                "request": {
                    "method": "POST",
                    "header": [{"key": "Authorization", "value": "Bearer {{access_token}}", "type": "text"}],
                    "body": {"mode": "raw", "raw": "{\n    \"institutionId\": \"UUID\",\n    \"majorId\": \"UUID\",\n    \"educationLevelId\": \"UUID\",\n    \"startDate\": \"2022-09-01\",\n    \"isCurrent\": true\n}", "options": {"raw": {"language": "json"}}},
                    "url": {"raw": "{{base_url}}/api/v1/profile/educations", "host": ["{{base_url}}"], "path": ["api", "v1", "profile", "educations"]}
                }
            },
            {
                "name": "List Educations",
                "request": {
                    "method": "GET",
                    "header": [{"key": "Authorization", "value": "Bearer {{access_token}}", "type": "text"}],
                    "url": {"raw": "{{base_url}}/api/v1/profile/educations", "host": ["{{base_url}}"], "path": ["api", "v1", "profile", "educations"]}
                }
            },
            {
                "name": "Get Single Education",
                "request": {
                    "method": "GET",
                    "header": [{"key": "Authorization", "value": "Bearer {{access_token}}", "type": "text"}],
                    "url": {"raw": "{{base_url}}/api/v1/profile/educations/:id", "host": ["{{base_url}}"], "path": ["api", "v1", "profile", "educations", ":id"], "variable": [{"key": "id", "value": "UUID"}]}
                }
            },
            {
                "name": "Update Education",
                "request": {
                    "method": "PATCH",
                    "header": [{"key": "Authorization", "value": "Bearer {{access_token}}", "type": "text"}],
                    "body": {"mode": "raw", "raw": "{\n    \"gpaRaw\": 3.8\n}", "options": {"raw": {"language": "json"}}},
                    "url": {"raw": "{{base_url}}/api/v1/profile/educations/:id", "host": ["{{base_url}}"], "path": ["api", "v1", "profile", "educations", ":id"], "variable": [{"key": "id", "value": "UUID"}]}
                }
            },
            {
                "name": "Delete Education",
                "request": {
                    "method": "DELETE",
                    "header": [{"key": "Authorization", "value": "Bearer {{access_token}}", "type": "text"}],
                    "url": {"raw": "{{base_url}}/api/v1/profile/educations/:id", "host": ["{{base_url}}"], "path": ["api", "v1", "profile", "educations", ":id"], "variable": [{"key": "id", "value": "UUID"}]}
                }
            }
        ]
    }
    new_items.append(profile_item)

    # Reference Data
    reference_item = {
        "name": "Reference Data",
        "item": []
    }
    
    endpoints = ["countries", "cities", "marital-statuses", "education-levels", "app-languages", "major-categories", "majors", "institutions"]
    for ep in endpoints:
        reference_item["item"].append({
            "name": f"List {ep.replace('-', ' ').title()}",
            "request": {
                "method": "GET",
                "url": {
                    "raw": f"{{{{base_url}}}}/api/v1/reference/{ep}",
                    "host": ["{{base_url}}"],
                    "path": ["api", "v1", "reference", ep]
                }
            }
        })
        
    new_items.append(reference_item)

    if health_items:
        new_items.append({"name": "Health", "item": health_items})

    data['item'] = new_items

    with open(filename, 'w') as f:
        json.dump(data, f, indent=4)
        
process('Levora_API.postman_collection.json')
process('Levora_API_localhost.postman_collection.json')

