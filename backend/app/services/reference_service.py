"""
Kalakar Setu — Reference Data Service
Queries and seed data for crafts, locations, and languages.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.reference import CraftType, State, District, SupportedLanguage


async def get_crafts(db: AsyncSession) -> list[CraftType]:
    """Get all active craft types."""
    result = await db.execute(
        select(CraftType)
        .where(CraftType.is_active == True)
        .order_by(CraftType.display_order)
    )
    return list(result.scalars().all())


async def get_states(db: AsyncSession) -> list[State]:
    """Get all states."""
    result = await db.execute(select(State).order_by(State.name_en))
    return list(result.scalars().all())


async def get_districts(db: AsyncSession, state_code: str | None = None) -> list[District]:
    """Get districts, optionally filtered by state."""
    query = select(District).order_by(District.name_en)
    if state_code:
        query = query.where(District.state_code == state_code)
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_languages(db: AsyncSession) -> list[SupportedLanguage]:
    """Get all active supported languages."""
    result = await db.execute(
        select(SupportedLanguage)
        .where(SupportedLanguage.is_active == True)
        .order_by(SupportedLanguage.display_order)
    )
    return list(result.scalars().all())


async def seed_reference_data(db: AsyncSession):
    """Seed the database with initial reference data. Idempotent."""

    # --- Languages ---
    languages = [
        SupportedLanguage(code="hi", name_en="Hindi", name_native="हिन्दी", display_order=1),
        SupportedLanguage(code="en", name_en="English", name_native="English", display_order=2),
        SupportedLanguage(code="mr", name_en="Marathi", name_native="मराठी", display_order=3),
        SupportedLanguage(code="bn", name_en="Bengali", name_native="বাংলা", display_order=4),
        SupportedLanguage(code="ta", name_en="Tamil", name_native="தமிழ்", display_order=5),
        SupportedLanguage(code="gu", name_en="Gujarati", name_native="ગુજરાતી", display_order=6),
    ]
    for lang in languages:
        existing = await db.execute(
            select(SupportedLanguage).where(SupportedLanguage.code == lang.code)
        )
        if not existing.scalar_one_or_none():
            db.add(lang)

    # --- Craft Types ---
    crafts = [
        CraftType(id="pottery", name_en="Pottery & Ceramics", name_hi="मिट्टी के बर्तन", icon="🏺", display_order=1),
        CraftType(id="weaving", name_en="Weaving & Textiles", name_hi="बुनाई और कपड़े", icon="🧶", display_order=2),
        CraftType(id="embroidery", name_en="Embroidery", name_hi="कढ़ाई", icon="🪡", display_order=3),
        CraftType(id="woodwork", name_en="Woodwork & Carving", name_hi="लकड़ी का काम", icon="🪵", display_order=4),
        CraftType(id="metalwork", name_en="Metalwork & Brass", name_hi="धातु का काम", icon="⚒️", display_order=5),
        CraftType(id="painting", name_en="Painting & Art", name_hi="चित्रकारी", icon="🎨", display_order=6),
        CraftType(id="bamboo", name_en="Bamboo & Cane", name_hi="बांस और बेंत", icon="🎋", display_order=7),
        CraftType(id="leather", name_en="Leather Craft", name_hi="चमड़े का काम", icon="👜", display_order=8),
        CraftType(id="stone", name_en="Stone Carving", name_hi="पत्थर की नक्काशी", icon="🗿", display_order=9),
        CraftType(id="block_print", name_en="Block Printing", name_hi="ब्लॉक प्रिंटिंग", icon="🖌️", display_order=10),
        CraftType(id="jewelry", name_en="Jewelry & Ornaments", name_hi="आभूषण", icon="💍", display_order=11),
        CraftType(id="papier_mache", name_en="Papier-Mâché", name_hi="कागज़ की लुगदी", icon="🎭", display_order=12),
        CraftType(id="other", name_en="Other Craft", name_hi="अन्य शिल्प", icon="✨", display_order=99),
    ]
    for craft in crafts:
        existing = await db.execute(
            select(CraftType).where(CraftType.id == craft.id)
        )
        if not existing.scalar_one_or_none():
            db.add(craft)

    # --- States (major Indian states) ---
    states = [
        State(code="AP", name_en="Andhra Pradesh", name_hi="आंध्र प्रदेश"),
        State(code="AR", name_en="Arunachal Pradesh", name_hi="अरुणाचल प्रदेश"),
        State(code="AS", name_en="Assam", name_hi="असम"),
        State(code="BR", name_en="Bihar", name_hi="बिहार"),
        State(code="CT", name_en="Chhattisgarh", name_hi="छत्तीसगढ़"),
        State(code="GA", name_en="Goa", name_hi="गोवा"),
        State(code="GJ", name_en="Gujarat", name_hi="गुजरात"),
        State(code="HR", name_en="Haryana", name_hi="हरियाणा"),
        State(code="HP", name_en="Himachal Pradesh", name_hi="हिमाचल प्रदेश"),
        State(code="JH", name_en="Jharkhand", name_hi="झारखंड"),
        State(code="KA", name_en="Karnataka", name_hi="कर्नाटक"),
        State(code="KL", name_en="Kerala", name_hi="केरल"),
        State(code="MP", name_en="Madhya Pradesh", name_hi="मध्य प्रदेश"),
        State(code="MH", name_en="Maharashtra", name_hi="महाराष्ट्र"),
        State(code="MN", name_en="Manipur", name_hi="मणिपुर"),
        State(code="ML", name_en="Meghalaya", name_hi="मेघालय"),
        State(code="MZ", name_en="Mizoram", name_hi="मिज़ोरम"),
        State(code="NL", name_en="Nagaland", name_hi="नागालैंड"),
        State(code="OR", name_en="Odisha", name_hi="ओडिशा"),
        State(code="PB", name_en="Punjab", name_hi="पंजाब"),
        State(code="RJ", name_en="Rajasthan", name_hi="राजस्थान"),
        State(code="SK", name_en="Sikkim", name_hi="सिक्किम"),
        State(code="TN", name_en="Tamil Nadu", name_hi="तमिल नाडु"),
        State(code="TG", name_en="Telangana", name_hi="तेलंगाना"),
        State(code="TR", name_en="Tripura", name_hi="त्रिपुरा"),
        State(code="UP", name_en="Uttar Pradesh", name_hi="उत्तर प्रदेश"),
        State(code="UK", name_en="Uttarakhand", name_hi="उत्तराखंड"),
        State(code="WB", name_en="West Bengal", name_hi="पश्चिम बंगाल"),
        State(code="DL", name_en="Delhi", name_hi="दिल्ली"),
        State(code="JK", name_en="Jammu & Kashmir", name_hi="जम्मू और कश्मीर"),
    ]
    for state in states:
        existing = await db.execute(
            select(State).where(State.code == state.code)
        )
        if not existing.scalar_one_or_none():
            db.add(state)

    # --- Sample Districts (Rajasthan as example, expandable) ---
    districts = [
        District(code="RJ-JAI", state_code="RJ", name_en="Jaipur", name_hi="जयपुर"),
        District(code="RJ-JOD", state_code="RJ", name_en="Jodhpur", name_hi="जोधपुर"),
        District(code="RJ-UDA", state_code="RJ", name_en="Udaipur", name_hi="उदयपुर"),
        District(code="RJ-JAL", state_code="RJ", name_en="Jaisalmer", name_hi="जैसलमेर"),
        District(code="RJ-AJM", state_code="RJ", name_en="Ajmer", name_hi="अजमेर"),
        District(code="UP-LKO", state_code="UP", name_en="Lucknow", name_hi="लखनऊ"),
        District(code="UP-VNS", state_code="UP", name_en="Varanasi", name_hi="वाराणसी"),
        District(code="UP-AGR", state_code="UP", name_en="Agra", name_hi="आगरा"),
        District(code="WB-KOL", state_code="WB", name_en="Kolkata", name_hi="कोलकाता"),
        District(code="WB-HOW", state_code="WB", name_en="Howrah", name_hi="हावड़ा"),
        District(code="MH-MUM", state_code="MH", name_en="Mumbai", name_hi="मुंबई"),
        District(code="MH-PUN", state_code="MH", name_en="Pune", name_hi="पुणे"),
        District(code="MH-NGP", state_code="MH", name_en="Nagpur", name_hi="नागपुर"),
        District(code="GJ-AHM", state_code="GJ", name_en="Ahmedabad", name_hi="अहमदाबाद"),
        District(code="GJ-KUT", state_code="GJ", name_en="Kutch", name_hi="कच्छ"),
        District(code="KA-BLR", state_code="KA", name_en="Bengaluru", name_hi="बेंगलुरु"),
        District(code="TN-CHE", state_code="TN", name_en="Chennai", name_hi="चेन्नई"),
        District(code="KL-TVM", state_code="KL", name_en="Thiruvananthapuram", name_hi="तिरुवनंतपुरम"),
        District(code="DL-DL", state_code="DL", name_en="New Delhi", name_hi="नई दिल्ली"),
        District(code="JK-SRN", state_code="JK", name_en="Srinagar", name_hi="श्रीनगर"),
        District(code="AP-VSK", state_code="AP", name_en="Visakhapatnam", name_hi="विशाखापत्तनम"),
        District(code="AP-VJA", state_code="AP", name_en="Vijayawada", name_hi="विजयवाड़ा"),
        District(code="AR-ITA", state_code="AR", name_en="Itanagar", name_hi="ईटानगर"),
        District(code="AS-GHY", state_code="AS", name_en="Guwahati", name_hi="गुवाहाटी"),
        District(code="AS-DIB", state_code="AS", name_en="Dibrugarh", name_hi="डिब्रूगढ़"),
        District(code="BR-PAT", state_code="BR", name_en="Patna", name_hi="पटना"),
        District(code="BR-GAY", state_code="BR", name_en="Gaya", name_hi="गया"),
        District(code="CT-RAI", state_code="CT", name_en="Raipur", name_hi="रायपुर"),
        District(code="CT-BIL", state_code="CT", name_en="Bilaspur", name_hi="बिलासपुर"),
        District(code="GA-PAN", state_code="GA", name_en="Panaji", name_hi="पणजी"),
        District(code="GA-MAR", state_code="GA", name_en="Margao", name_hi="मडगांव"),
        District(code="HR-GUR", state_code="HR", name_en="Gurugram", name_hi="गुरुग्राम"),
        District(code="HR-FAR", state_code="HR", name_en="Faridabad", name_hi="फरीदाबाद"),
        District(code="HP-SHM", state_code="HP", name_en="Shimla", name_hi="शिमला"),
        District(code="HP-MAN", state_code="HP", name_en="Manali", name_hi="मनाली"),
        District(code="JH-RAN", state_code="JH", name_en="Ranchi", name_hi="राँची"),
        District(code="JH-JAM", state_code="JH", name_en="Jamshedpur", name_hi="जमशेदपुर"),
        District(code="MP-BHO", state_code="MP", name_en="Bhopal", name_hi="भोपाल"),
        District(code="MP-IND", state_code="MP", name_en="Indore", name_hi="इंदौर"),
        District(code="MN-IMP", state_code="MN", name_en="Imphal", name_hi="इंफाल"),
        District(code="ML-SHL", state_code="ML", name_en="Shillong", name_hi="शिलांग"),
        District(code="MZ-AIZ", state_code="MZ", name_en="Aizawl", name_hi="आइजोल"),
        District(code="NL-KOH", state_code="NL", name_en="Kohima", name_hi="कोहिमा"),
        District(code="OR-BBS", state_code="OR", name_en="Bhubaneswar", name_hi="भुवनेश्वर"),
        District(code="OR-CUT", state_code="OR", name_en="Cuttack", name_hi="कटक"),
        District(code="PB-AMR", state_code="PB", name_en="Amritsar", name_hi="अमृतसर"),
        District(code="PB-LUD", state_code="PB", name_en="Ludhiana", name_hi="लुधियाना"),
        District(code="SK-GAN", state_code="SK", name_en="Gangtok", name_hi="गंगटोक"),
        District(code="TG-HYD", state_code="TG", name_en="Hyderabad", name_hi="हैदराबाद"),
        District(code="TG-WAR", state_code="TG", name_en="Warangal", name_hi="वारंगल"),
        District(code="TR-AGA", state_code="TR", name_en="Agartala", name_hi="अगरतला"),
        District(code="UK-DEH", state_code="UK", name_en="Dehradun", name_hi="देहरादून"),
        District(code="UK-HAR", state_code="UK", name_en="Haridwar", name_hi="हरिद्वार"),
    ]
    for district in districts:
        existing = await db.execute(
            select(District).where(District.code == district.code)
        )
        if not existing.scalar_one_or_none():
            db.add(district)

    await db.flush()
