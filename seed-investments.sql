-- One-time import of startup capital-expense data from Soupresso Investment.xlsx.
-- No per-item dates exist in the source; every row defaults to 2026-08-13 (the
-- cutoff date referenced in the sheet's own 'Food Taste & Raw Materials till
-- 13.08.2026' section header). Edit individual dates afterward via the Investments page.
-- Guarded so it only runs against an empty table (safe to re-run scripts/init-db.js).
DO $$
BEGIN
  IF (SELECT COUNT(*) FROM investments) = 0 THEN
    INSERT INTO investments (spent_on, category, description, amount, notes) VALUES ('2026-08-13', 'Food Cart', 'Food cart', 21000, NULL);
    INSERT INTO investments (spent_on, category, description, amount, notes) VALUES ('2026-08-13', 'Food Cart', 'Food Cart- Welding', 3100, NULL);
    INSERT INTO investments (spent_on, category, description, amount, notes) VALUES ('2026-08-13', 'Food Cart', 'Food Cart- Paint', 2550, NULL);
    INSERT INTO investments (spent_on, category, description, amount, notes) VALUES ('2026-08-13', 'Food Cart', 'Food Cart- L. Lock (4 x 150)', 600, NULL);
    INSERT INTO investments (spent_on, category, description, amount, notes) VALUES ('2026-08-13', 'Food Cart', 'Food Cart- B. Lock', 240, NULL);
    INSERT INTO investments (spent_on, category, description, amount, notes) VALUES ('2026-08-13', 'Food Cart', 'Food Cart- Carrying Van rent', 700, NULL);
    INSERT INTO investments (spent_on, category, description, amount, notes) VALUES ('2026-08-13', 'Food Cart', 'Food Cart- Neon light', 1050, NULL);
    INSERT INTO investments (spent_on, category, description, amount, notes) VALUES ('2026-08-13', 'Food Cart', 'Food Cart- Electric Accessories', 4140, NULL);
    INSERT INTO investments (spent_on, category, description, amount, notes) VALUES ('2026-08-13', 'Food Cart', 'Food Cart- Electric Bill', 1300, NULL);
    INSERT INTO investments (spent_on, category, description, amount, notes) VALUES ('2026-08-13', 'Food Cart', 'Food Cart- Sign Board', 4000, NULL);
    INSERT INTO investments (spent_on, category, description, amount, notes) VALUES ('2026-08-13', 'Food Cart', 'Food Cart- Sticker', 400, NULL);
    INSERT INTO investments (spent_on, category, description, amount, notes) VALUES ('2026-08-13', 'Food Cart', 'Food Cart- Wooden Platform', 1200, NULL);
    INSERT INTO investments (spent_on, category, description, amount, notes) VALUES ('2026-08-13', 'Food Cart', 'Food Cart - Lock 4*450', 1800, NULL);
    INSERT INTO investments (spent_on, category, description, amount, notes) VALUES ('2026-08-13', 'Food Cart', 'Food Cart - Seating Tool', 1650, NULL);
    INSERT INTO investments (spent_on, category, description, amount, notes) VALUES ('2026-08-13', 'Food Cart', 'Food Cart- Rack', 350, NULL);
    INSERT INTO investments (spent_on, category, description, amount, notes) VALUES ('2026-08-13', 'Food Cart', 'Food Cart- Fan', 1400, NULL);
    INSERT INTO investments (spent_on, category, description, amount, notes) VALUES ('2026-08-13', 'Food Cart', 'Food Cart Multi Plug', 750, NULL);
    INSERT INTO investments (spent_on, category, description, amount, notes) VALUES ('2026-08-13', 'Food Cart', 'Food Cart- Bin & Bin Poly', 300, NULL);
    INSERT INTO investments (spent_on, category, description, amount, notes) VALUES ('2026-08-13', 'Chef Home Development', 'Chef Home- Mattress', 550, NULL);
    INSERT INTO investments (spent_on, category, description, amount, notes) VALUES ('2026-08-13', 'Chef Home Development', 'Chef Home- Bed Sheet', 480, NULL);
    INSERT INTO investments (spent_on, category, description, amount, notes) VALUES ('2026-08-13', 'Chef Home Development', 'Chef Home- Pillow', 150, NULL);
    INSERT INTO investments (spent_on, category, description, amount, notes) VALUES ('2026-08-13', 'Chef Home Development', 'Chef Home- Push Shower', 350, NULL);
    INSERT INTO investments (spent_on, category, description, amount, notes) VALUES ('2026-08-13', 'Chef Home Development', 'Chef Home- Tap- 2', 370, NULL);
    INSERT INTO investments (spent_on, category, description, amount, notes) VALUES ('2026-08-13', 'Chef Home Development', 'Chef Home- Wiring, Socket & others', 850, NULL);
    INSERT INTO investments (spent_on, category, description, amount, notes) VALUES ('2026-08-13', 'Chef Home Development', 'Chef Home- Holder', 30, NULL);
    INSERT INTO investments (spent_on, category, description, amount, notes) VALUES ('2026-08-13', 'Chef Home Development', 'Chef Home- Plug', 25, NULL);
    INSERT INTO investments (spent_on, category, description, amount, notes) VALUES ('2026-08-13', 'Chef Home Development', 'Chef Home- Light', 100, NULL);
    INSERT INTO investments (spent_on, category, description, amount, notes) VALUES ('2026-08-13', 'Chef Home Development', 'Chef Home- Senetary Working Bill', 500, NULL);
    INSERT INTO investments (spent_on, category, description, amount, notes) VALUES ('2026-08-13', 'Chef Home Development', 'Chef Home- Fan & Regulator', 800, NULL);
    INSERT INTO investments (spent_on, category, description, amount, notes) VALUES ('2026-08-13', 'Chef Home Development', 'Chef Home- Painting and Painter Bill', 1600, NULL);
    INSERT INTO investments (spent_on, category, description, amount, notes) VALUES ('2026-08-13', 'Chef Home Development', 'Chef Home- Fridge with Van Fare & Electric Bill', 13200, NULL);
    INSERT INTO investments (spent_on, category, description, amount, notes) VALUES ('2026-08-13', 'Gas', 'Gas 12kg for Shop', 1750, NULL);
    INSERT INTO investments (spent_on, category, description, amount, notes) VALUES ('2026-08-13', 'Gas', 'Gas 33 kg at Home', 5000, NULL);
    INSERT INTO investments (spent_on, category, description, amount, notes) VALUES ('2026-08-13', 'Gas', 'Regulator', 750, NULL);
    INSERT INTO investments (spent_on, category, description, amount, notes) VALUES ('2026-08-13', 'Gas', 'Pipe', 180, NULL);
    INSERT INTO investments (spent_on, category, description, amount, notes) VALUES ('2026-08-13', 'Gas', 'Clip', 20, NULL);
    INSERT INTO investments (spent_on, category, description, amount, notes) VALUES ('2026-08-13', 'Gas', 'Extra for Gas', 300, NULL);
    INSERT INTO investments (spent_on, category, description, amount, notes) VALUES ('2026-08-13', 'Convayance & Misc', 'Mirpur rickshaw', 200, NULL);
    INSERT INTO investments (spent_on, category, description, amount, notes) VALUES ('2026-08-13', 'Convayance & Misc', 'Mirpur updown (3 days)', 200, NULL);
    INSERT INTO investments (spent_on, category, description, amount, notes) VALUES ('2026-08-13', 'Convayance & Misc', 'Mirpur Rickshaw rent', 600, NULL);
    INSERT INTO investments (spent_on, category, description, amount, notes) VALUES ('2026-08-13', 'Convayance & Misc', 'Snacks, Convayance, Labore Bill & Donation', 2170, NULL);
    INSERT INTO investments (spent_on, category, description, amount, notes) VALUES ('2026-08-13', 'Convayance & Misc', 'Auto Fare, Snacks', 310, NULL);
    INSERT INTO investments (spent_on, category, description, amount, notes) VALUES ('2026-08-13', 'Convayance & Misc', 'Convayance', 200, NULL);
    INSERT INTO investments (spent_on, category, description, amount, notes) VALUES ('2026-08-13', 'Convayance & Misc', 'Convayance', 500, NULL);
    INSERT INTO investments (spent_on, category, description, amount, notes) VALUES ('2026-08-13', 'Food Taste & Raw Materials', 'Taquitos Taste', 1250, NULL);
    INSERT INTO investments (spent_on, category, description, amount, notes) VALUES ('2026-08-13', 'Food Taste & Raw Materials', 'Soup taste', 1000, NULL);
    INSERT INTO investments (spent_on, category, description, amount, notes) VALUES ('2026-08-13', 'Food Taste & Raw Materials', 'Thai Gin & Leaf', 400, NULL);
    INSERT INTO investments (spent_on, category, description, amount, notes) VALUES ('2026-08-13', 'Food Taste & Raw Materials', 'Chicken (loose)', 1440, NULL);
    INSERT INTO investments (spent_on, category, description, amount, notes) VALUES ('2026-08-13', 'Food Taste & Raw Materials', 'Chicken from Aziz', 1000, NULL);
    INSERT INTO investments (spent_on, category, description, amount, notes) VALUES ('2026-08-13', 'Food Taste & Raw Materials', 'Sausage, Mashroom, Vinegar', 1910, NULL);
    INSERT INTO investments (spent_on, category, description, amount, notes) VALUES ('2026-08-13', 'Food Taste & Raw Materials', 'Parcel Cox, Sauce', 830, NULL);
    INSERT INTO investments (spent_on, category, description, amount, notes) VALUES ('2026-08-13', 'Food Taste & Raw Materials', 'Egg 20pc', 250, NULL);
    INSERT INTO investments (spent_on, category, description, amount, notes) VALUES ('2026-08-13', 'Food Taste & Raw Materials', 'Coriander', 40, NULL);
    INSERT INTO investments (spent_on, category, description, amount, notes) VALUES ('2026-08-13', 'Food Taste & Raw Materials', 'Onthon Sheet', 1050, NULL);
    INSERT INTO investments (spent_on, category, description, amount, notes) VALUES ('2026-08-13', 'Food Taste & Raw Materials', 'Vegetables', 60, NULL);
    INSERT INTO investments (spent_on, category, description, amount, notes) VALUES ('2026-08-13', 'Food Taste & Raw Materials', 'Water', 100, NULL);
    INSERT INTO investments (spent_on, category, description, amount, notes) VALUES ('2026-08-13', 'Food Taste & Raw Materials', 'Water for Sale', 340, NULL);
    INSERT INTO investments (spent_on, category, description, amount, notes) VALUES ('2026-08-13', 'Food Taste & Raw Materials', 'Chilis', 30, NULL);
    INSERT INTO investments (spent_on, category, description, amount, notes) VALUES ('2026-08-13', 'Food Taste & Raw Materials', 'Groceries', 1000, NULL);
    INSERT INTO investments (spent_on, category, description, amount, notes) VALUES ('2026-08-13', 'Food Taste & Raw Materials', 'Chicken Wings 2kg', 800, NULL);
    INSERT INTO investments (spent_on, category, description, amount, notes) VALUES ('2026-08-13', 'Food Taste & Raw Materials', 'Mashroom, Oil, Fish Sauce, Barli, Cornflower', 2900, NULL);
    INSERT INTO investments (spent_on, category, description, amount, notes) VALUES ('2026-08-13', 'Food Taste & Raw Materials', 'Vegetables', 330, NULL);
    INSERT INTO investments (spent_on, category, description, amount, notes) VALUES ('2026-08-13', 'Cookaries & Accessories', 'Soup Cup, Spoon, Saucer set', 2700, 'Soup Cup 12 pc x 133.33 = 1600; Spoon 12 pc x 58.33 = 700; Saucer 6 pc x 66.66 = 400; Total 2,700');
    INSERT INTO investments (spent_on, category, description, amount, notes) VALUES ('2026-08-13', 'Cookaries & Accessories', 'Cooking Pot 2 Pc(s)', 6700, NULL);
    INSERT INTO investments (spent_on, category, description, amount, notes) VALUES ('2026-08-13', 'Cookaries & Accessories', 'Kitchen Setup (Stove, Knife, Spoon etc.)', 6550, NULL);
    INSERT INTO investments (spent_on, category, description, amount, notes) VALUES ('2026-08-13', 'Cookaries & Accessories', 'Burner stove', 3150, NULL);
    INSERT INTO investments (spent_on, category, description, amount, notes) VALUES ('2026-08-13', 'Cookaries & Accessories', 'Juicer', 3000, NULL);
    INSERT INTO investments (spent_on, category, description, amount, notes) VALUES ('2026-08-13', 'Cookaries & Accessories', 'Grinder', 3500, NULL);
    INSERT INTO investments (spent_on, category, description, amount, notes) VALUES ('2026-08-13', 'Cookaries & Accessories', 'Egg Mixer', 120, NULL);
    INSERT INTO investments (spent_on, category, description, amount, notes) VALUES ('2026-08-13', 'Cookaries & Accessories', 'Cork Sheet', 450, NULL);
    INSERT INTO investments (spent_on, category, description, amount, notes) VALUES ('2026-08-13', 'Cookaries & Accessories', 'Tripol', 300, NULL);
    INSERT INTO investments (spent_on, category, description, amount, notes) VALUES ('2026-08-13', 'Cookaries & Accessories', 'Rope', 60, NULL);
    INSERT INTO investments (spent_on, category, description, amount, notes) VALUES ('2026-08-13', 'Cookaries & Accessories', 'Poly', 380, NULL);
    INSERT INTO investments (spent_on, category, description, amount, notes) VALUES ('2026-08-13', 'Cookaries & Accessories', 'Chef Hand Gloves, Cap', 300, NULL);
    INSERT INTO investments (spent_on, category, description, amount, notes) VALUES ('2026-08-13', 'Cookaries & Accessories', 'Frying Pan', 730, NULL);
    INSERT INTO investments (spent_on, category, description, amount, notes) VALUES ('2026-08-13', 'Cookaries & Accessories', 'Fry Net', 280, NULL);
    INSERT INTO investments (spent_on, category, description, amount, notes) VALUES ('2026-08-13', 'Cookaries & Accessories', 'Soup Cup, Spoon, Chaina Tray', 2460, NULL);
    INSERT INTO investments (spent_on, category, description, amount, notes) VALUES ('2026-08-13', 'Cookaries & Accessories', 'Star Gas, Burner', 560, NULL);
    INSERT INTO investments (spent_on, category, description, amount, notes) VALUES ('2026-08-13', 'Cookaries & Accessories', 'Bucket, Bowl, Net', 1320, NULL);
    INSERT INTO investments (spent_on, category, description, amount, notes) VALUES ('2026-08-13', 'Cookaries & Accessories', 'Chopping Board', 150, NULL);
    INSERT INTO investments (spent_on, category, description, amount, notes) VALUES ('2026-08-13', 'Cookaries & Accessories', 'Chain', 360, NULL);
    INSERT INTO investments (spent_on, category, description, amount, notes) VALUES ('2026-08-13', 'Cookaries & Accessories', 'Knife', 150, NULL);
    INSERT INTO investments (spent_on, category, description, amount, notes) VALUES ('2026-08-13', 'Cookaries & Accessories', 'Key Making', 140, NULL);
    INSERT INTO investments (spent_on, category, description, amount, notes) VALUES ('2026-08-13', 'Cookaries & Accessories', 'Piller & Grader', 300, NULL);
    INSERT INTO investments (spent_on, category, description, amount, notes) VALUES ('2026-08-13', 'Cookaries & Accessories', 'Print & Laminating & Clip Board', 420, NULL);
    INSERT INTO investments (spent_on, category, description, amount, notes) VALUES ('2026-08-13', 'Others', 'Polash Onetime & Baking', 2160, NULL);
    INSERT INTO investments (spent_on, category, description, amount, notes) VALUES ('2026-08-13', 'Others', 'Bandana', 500, NULL);
    INSERT INTO investments (spent_on, category, description, amount, notes) VALUES ('2026-08-13', 'Others', 'Tap', 350, NULL);
    INSERT INTO investments (spent_on, category, description, amount, notes) VALUES ('2026-08-13', 'Others', 'Bkash payment', 200, NULL);
    INSERT INTO investments (spent_on, category, description, amount, notes) VALUES ('2026-08-13', 'Others', 'Milk Food', 1100, NULL);
    INSERT INTO investments (spent_on, category, description, amount, notes) VALUES ('2026-08-13', 'Others', 'Bkash Cashout Charge', 200, NULL);
    INSERT INTO investments (spent_on, category, description, amount, notes) VALUES ('2026-08-13', 'Others', 'Miscelleneous', 2200, NULL);
    INSERT INTO investments (spent_on, category, description, amount, notes) VALUES ('2026-08-13', 'Others', 'Labour Bill', 50, NULL);
    INSERT INTO investments (spent_on, category, description, amount, notes) VALUES ('2026-08-13', 'Others', 'Phone Sim', 125, NULL);
  END IF;
END $$;

-- 94 rows imported, grand total 133410 (verified against the source spreadsheet's own subtotals).
