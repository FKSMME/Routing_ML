#!/usr/bin/env python3
"""Bulk User Registration - Simple Version (No backend imports)"""

import json
import requests

# 54명 사용자 데이터
USER_DATA = """
이석중 sjlee
이승용 sylee
이연홍 YHLee
김형민 hmkim
윤수용 syyun
김상민(FKSM) sangmkim
이경재 kjlee
서동수 dsseo
김나리 nrkim
김기범 kbkim
김택균 tkyunkim
신은철 ecshin
임채언 celim
윤석현 shyoon
이재범 jaeblee
나현민 hmna
김문기 moongkim
박지석 bjpark
신상범 sbshin
박차라 crpark
전재원 jwjun
이남용 nylee
송민권 mgsong
조민상 minscho
강연수 yskang
김민제 minjea
양소진 sjyang
민지현 jihmin
성대훈 dhsung
김상민(KSM) smkim
이순필 splee
이종주 jongjlee
황광준 kjhwang
신주용 jyshin
조정래 jrcho
안광민 gwangman
윤인중 ijyoon
오창성 csoh
강동진 arsmproctec
임경복 kbim
방성진 sungjbang
오영원 ywoh
고승민 smko
김민수 minsukim
박정하 jhapark
전상현 shjun
오기호 khoh
변호석 hsbyun
김영곤 ygkim
문정남 jnmoon
김동록 drkim
정혜경 hgjung
변희동 hdbyun
김민우 mwkim
김주환 joohwan
오창훈 choh
"""

def parse_users():
    users = []
    for line in USER_DATA.strip().split('\n'):
        parts = line.strip().rsplit(' ', 1)
        if len(parts) == 2:
            full_name, username = parts
            display_name = full_name.split('(')[0].strip()
            users.append({
                "username": username,
                "full_name": full_name,
                "display_name": display_name,
                "password": "ksm@1234",
                "make_admin": False
            })
    return users

def main():
    users = parse_users()
    print(f"Parsed {len(users)} users")
    
    payload = {
        "users": users,
        "auto_approve": True,
        "force_password_change": False,
        "notify": False,
        "overwrite_existing": False
    }
    
    # Save to JSON file
    with open('bulk_users_payload.json', 'w', encoding='utf-8') as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    
    print(f"✅ Payload saved to bulk_users_payload.json")
    print(f"   Total users: {len(users)}")

if __name__ == "__main__":
    main()
