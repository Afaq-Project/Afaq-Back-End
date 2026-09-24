import json

def fix_vars(filename):
    with open(filename, 'r') as f:
        content = f.read()
    
    # Simple string replacements to fix variable names and redundant paths
    content = content.replace('{{base_url}}/api/v1', '{{baseUrl}}')
    content = content.replace('{{access_token}}', '{{accessToken}}')
    content = content.replace('base_url', 'baseUrl')
    
    with open(filename, 'w') as f:
        f.write(content)

fix_vars('Levora_API.postman_collection.json')
fix_vars('Levora_API_localhost.postman_collection.json')
