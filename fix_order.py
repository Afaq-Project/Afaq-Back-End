import json

with open('tests/levora-smoke-tests.json', 'r') as f:
    data = json.load(f)

for item in data['item']:
    if item['name'] == 'Profile CRUD':
        crud_items = item['item']
        
        # We need to move:
        # "GET /profile/educations/{{education_id}}" before "DELETE /profile/educations/{{education_id}}"
        # "GET /profile/languages/{{profile_language_id}}" before "DELETE /profile/languages/{{profile_language_id}}"
        # "GET /profile/test-results/{{test_result_id}}" before "DELETE /profile/test-results/{{test_result_id}}"
        
        def move_before(get_name, del_name):
            get_idx = next(i for i, x in enumerate(crud_items) if x['name'] == get_name)
            get_obj = crud_items.pop(get_idx)
            del_idx = next(i for i, x in enumerate(crud_items) if x['name'] == del_name)
            crud_items.insert(del_idx, get_obj)

        move_before("GET /profile/educations/{{education_id}}", "DELETE /profile/educations/{{education_id}}")
        move_before("GET /profile/languages/{{profile_language_id}}", "DELETE /profile/languages/{{profile_language_id}}")
        move_before("GET /profile/test-results/{{test_result_id}}", "DELETE /profile/test-results/{{test_result_id}}")

with open('tests/levora-smoke-tests.json', 'w') as f:
    json.dump(data, f, indent=2)

