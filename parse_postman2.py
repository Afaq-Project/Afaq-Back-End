import json

def process(filename):
    with open(filename, 'r') as f:
        data = json.load(f)
    
    for folder in data.get('item', []):
        if folder.get('name') == 'Auth':
            new_auth = []
            for item in folder.get('item', []):
                if 'Profile' not in item.get('name', ''):
                    new_auth.append(item)
            folder['item'] = new_auth

    with open(filename, 'w') as f:
        json.dump(data, f, indent=4)
        
process('Levora_API.postman_collection.json')
process('Levora_API_localhost.postman_collection.json')

