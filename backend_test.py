#!/usr/bin/env python3
"""
Backend API Testing for Rewind Ventures Lead Management System
Tests all lead endpoints with proper validation and error handling
"""

import requests
import json
import sys
from datetime import datetime
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv('/app/frontend/.env')

# Get backend URL from frontend environment
BACKEND_URL = os.getenv('REACT_APP_BACKEND_URL', 'https://sport-venue-setup.preview.emergentagent.com')
BASE_API_URL = f"{BACKEND_URL}/api"

print(f"Testing backend at: {BASE_API_URL}")

def test_hello_world():
    """Test GET /api/ endpoint"""
    print("\n=== Testing GET /api/ (Hello World) ===")
    try:
        response = requests.get(f"{BASE_API_URL}/")
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.json()}")
        
        if response.status_code == 200:
            data = response.json()
            if "message" in data and "Hello World" in data["message"]:
                print("✅ Hello World endpoint working correctly")
                return True
            else:
                print("❌ Hello World endpoint returned unexpected response")
                return False
        else:
            print(f"❌ Hello World endpoint failed with status {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Hello World endpoint error: {str(e)}")
        return False

def test_create_lead():
    """Test POST /api/leads with valid payload"""
    print("\n=== Testing POST /api/leads (Create Lead) ===")
    
    # Valid lead payload
    lead_data = {
        "name": "John Smith",
        "company": "Sports Arena Inc",
        "email": "john.smith@sportsarena.com",
        "phone": "+1-555-0123",
        "need": "Complete sports facility setup including lighting, sound system, and field maintenance equipment",
        "source": "landing_form"
    }
    
    try:
        response = requests.post(f"{BASE_API_URL}/leads", json=lead_data)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.json()}")
        
        if response.status_code == 200:
            data = response.json()
            required_fields = ["id", "status", "created_at", "name", "company", "email", "need", "source"]
            
            missing_fields = [field for field in required_fields if field not in data]
            if missing_fields:
                print(f"❌ Missing required fields: {missing_fields}")
                return False, None
            
            if data["status"] != "new":
                print(f"❌ Expected status 'new', got '{data['status']}'")
                return False, None
            
            # Validate created_at is a valid datetime
            try:
                datetime.fromisoformat(data["created_at"].replace('Z', '+00:00'))
            except:
                print(f"❌ Invalid created_at format: {data['created_at']}")
                return False, None
            
            print("✅ Lead created successfully with all required fields")
            return True, data["id"]
        else:
            print(f"❌ Create lead failed with status {response.status_code}")
            return False, None
    except Exception as e:
        print(f"❌ Create lead error: {str(e)}")
        return False, None

def test_list_leads(expected_lead_id=None):
    """Test GET /api/leads?limit=6"""
    print("\n=== Testing GET /api/leads?limit=6 (List Leads) ===")
    
    try:
        response = requests.get(f"{BASE_API_URL}/leads?limit=6")
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Number of leads returned: {len(data)}")
            
            if not isinstance(data, list):
                print("❌ Response should be an array")
                return False
            
            if expected_lead_id:
                lead_found = any(lead.get("id") == expected_lead_id for lead in data)
                if lead_found:
                    print(f"✅ Created lead {expected_lead_id} found in list")
                else:
                    print(f"❌ Created lead {expected_lead_id} not found in list")
                    return False
            
            # Validate structure of first lead if any exist
            if data:
                first_lead = data[0]
                required_fields = ["id", "name", "company", "email", "status", "created_at"]
                missing_fields = [field for field in required_fields if field not in first_lead]
                if missing_fields:
                    print(f"❌ Lead missing required fields: {missing_fields}")
                    return False
            
            print("✅ List leads endpoint working correctly")
            return True
        else:
            print(f"❌ List leads failed with status {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ List leads error: {str(e)}")
        return False

def test_update_lead(lead_id):
    """Test PATCH /api/leads/{id} with status update"""
    print(f"\n=== Testing PATCH /api/leads/{lead_id} (Update Lead Status) ===")
    
    update_data = {"status": "contacted"}
    
    try:
        response = requests.patch(f"{BASE_API_URL}/leads/{lead_id}", json=update_data)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.json()}")
        
        if response.status_code == 200:
            data = response.json()
            
            if data.get("status") != "contacted":
                print(f"❌ Expected status 'contacted', got '{data.get('status')}'")
                return False
            
            if data.get("id") != lead_id:
                print(f"❌ Expected id '{lead_id}', got '{data.get('id')}'")
                return False
            
            print("✅ Lead status updated successfully")
            return True
        else:
            print(f"❌ Update lead failed with status {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Update lead error: {str(e)}")
        return False

def test_delete_lead(lead_id):
    """Test DELETE /api/leads/{id}"""
    print(f"\n=== Testing DELETE /api/leads/{lead_id} (Delete Lead) ===")
    
    try:
        response = requests.delete(f"{BASE_API_URL}/leads/{lead_id}")
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.json()}")
        
        if response.status_code == 200:
            data = response.json()
            
            if data.get("ok") != True:
                print(f"❌ Expected {{ok: true}}, got {data}")
                return False
            
            print("✅ Lead deleted successfully")
            return True
        else:
            print(f"❌ Delete lead failed with status {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Delete lead error: {str(e)}")
        return False

def test_validation_missing_email():
    """Test POST /api/leads with missing email (should return 422)"""
    print("\n=== Testing POST /api/leads (Missing Email Validation) ===")
    
    # Invalid lead payload - missing email
    invalid_lead_data = {
        "name": "Jane Doe",
        "company": "Test Company",
        "need": "Testing validation",
        "source": "landing_form"
    }
    
    try:
        response = requests.post(f"{BASE_API_URL}/leads", json=invalid_lead_data)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.json()}")
        
        if response.status_code == 422:
            print("✅ Validation correctly rejected missing email")
            return True
        else:
            print(f"❌ Expected 422 validation error, got {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Validation test error: {str(e)}")
        return False

def run_all_tests():
    """Run all backend API tests in sequence"""
    print("🚀 Starting Rewind Ventures Backend API Tests")
    print("=" * 60)
    
    results = []
    lead_id = None
    
    # Test 1: Hello World
    results.append(("Hello World", test_hello_world()))
    
    # Test 2: Create Lead
    success, lead_id = test_create_lead()
    results.append(("Create Lead", success))
    
    if lead_id:
        # Test 3: List Leads (with created lead)
        results.append(("List Leads (with created)", test_list_leads(lead_id)))
        
        # Test 4: Update Lead Status
        results.append(("Update Lead Status", test_update_lead(lead_id)))
        
        # Test 5: Delete Lead
        results.append(("Delete Lead", test_delete_lead(lead_id)))
        
        # Test 6: List Leads (after deletion)
        results.append(("List Leads (after deletion)", test_list_leads()))
    else:
        print("⚠️ Skipping subsequent tests due to lead creation failure")
        results.extend([
            ("List Leads (with created)", False),
            ("Update Lead Status", False),
            ("Delete Lead", False),
            ("List Leads (after deletion)", False)
        ])
    
    # Test 7: Validation
    results.append(("Email Validation", test_validation_missing_email()))
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 TEST RESULTS SUMMARY")
    print("=" * 60)
    
    passed = 0
    total = len(results)
    
    for test_name, success in results:
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{test_name:<30} {status}")
        if success:
            passed += 1
    
    print("-" * 60)
    print(f"Total: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed! Backend API is working correctly.")
        return True
    else:
        print(f"⚠️ {total - passed} test(s) failed. Backend needs attention.")
        return False

if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)