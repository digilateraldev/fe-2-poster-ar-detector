def detect_finger_from_contours(img):
    """Improved finger detection with better tip finding"""
    # Convert to HSV and threshold for skin color
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    lower_skin = np.array([0, 48, 80], dtype=np.uint8)
    upper_skin = np.array([20, 255, 255], dtype=np.uint8)
    mask = cv2.inRange(hsv, lower_skin, upper_skin)
    
    # Morphological operations
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5,5))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=2)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel, iterations=2)
    
    # Find contours
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None
    
    # Find the most finger-like contour
    best_cnt = None
    max_score = -1
    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area < 500:  # Minimum size
            continue
            
        # Get convex hull and defects
        hull = cv2.convexHull(cnt, returnPoints=False)
        if len(hull) > 3:
            defects = cv2.convexityDefects(cnt, hull)
            if defects is not None:
                # Score based on defects (finger joints)
                score = len(defects)
                if score > max_score:
                    max_score = score
                    best_cnt = cnt
    
    if best_cnt is None:
        best_cnt = max(contours, key=cv2.contourArea)
    
    # Find the highest point (finger tip)
    topmost = tuple(best_cnt[best_cnt[:,:,1].argmin()][0])
    return topmost
