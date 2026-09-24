import json

def check(filename):
    print(f"--- Checking {filename} ---")
    with open(filename, 'r') as f:
        data = json.load(f)
    
    for folder in data.get('item', []):
        print(f"Folder: {folder.get('name')}")
        for item in folder.get('item', []):
            method = item['request']['method']
            url = ""
            if isinstance(item['request']['url'], dict):
                url = item['request']['url'].get('raw', '')
            else:
                url = item['request']['url']
            print(f"  - [{method}] {url}")
            
            # Print body if exists and it's Profile
            if folder.get('name') == 'Profile' and 'body' in item['request']:
                print(f"    Body: {item['request']['body'].get('raw')[:100]}...")

check('Levora_API.postman_collection.json')
