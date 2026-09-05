-- Historical data import from SoupResso_Sales.xlsx
-- Corrected: Aug 11-14 expense = 1500 each (6000 total / 4 days)

INSERT INTO daily_entries (entry_date, total_counted, opening_bhangti, bazar_actual_cost, total_sales, bazar_variance, cash_taken_home, notes)
  VALUES ('2026-08-11', 2480, 0, 1500, 2480, 1500, 980, 'Imported from spreadsheet (expense corrected: 6000/4 days)') ON CONFLICT (entry_date) DO NOTHING;
INSERT INTO daily_entries (entry_date, total_counted, opening_bhangti, bazar_actual_cost, total_sales, bazar_variance, cash_taken_home, notes)
  VALUES ('2026-08-12', 2670, 0, 1500, 2670, 1500, 1170, 'Imported from spreadsheet (expense corrected: 6000/4 days)') ON CONFLICT (entry_date) DO NOTHING;
INSERT INTO daily_entries (entry_date, total_counted, opening_bhangti, bazar_actual_cost, total_sales, bazar_variance, cash_taken_home, notes)
  VALUES ('2026-08-13', 3630, 0, 1500, 3630, 1500, 2130, 'Imported from spreadsheet (expense corrected: 6000/4 days)') ON CONFLICT (entry_date) DO NOTHING;
INSERT INTO daily_entries (entry_date, total_counted, opening_bhangti, bazar_actual_cost, total_sales, bazar_variance, cash_taken_home, notes)
  VALUES ('2026-08-14', 6580, 0, 1500, 6580, 1500, 5080, 'Imported from spreadsheet (expense corrected: 6000/4 days)') ON CONFLICT (entry_date) DO NOTHING;
INSERT INTO daily_entries (entry_date, total_counted, opening_bhangti, bazar_actual_cost, total_sales, bazar_variance, cash_taken_home, notes)
  VALUES ('2026-08-15', 4230, 0, 530, 4230, 530, 3700, 'Imported from spreadsheet') ON CONFLICT (entry_date) DO NOTHING;
INSERT INTO daily_entries (entry_date, total_counted, opening_bhangti, bazar_actual_cost, total_sales, bazar_variance, cash_taken_home, notes)
  VALUES ('2026-08-16', 3675, 0, 4060, 3675, 4060, -385, 'Imported from spreadsheet') ON CONFLICT (entry_date) DO NOTHING;
INSERT INTO daily_entries (entry_date, total_counted, opening_bhangti, bazar_actual_cost, total_sales, bazar_variance, cash_taken_home, notes)
  VALUES ('2026-08-17', 3290, 0, 3615, 3290, 3615, -325, 'Imported from spreadsheet') ON CONFLICT (entry_date) DO NOTHING;
INSERT INTO daily_entries (entry_date, total_counted, opening_bhangti, bazar_actual_cost, total_sales, bazar_variance, cash_taken_home, notes)
  VALUES ('2026-08-18', 3240, 0, 1840, 3240, 1840, 1400, 'Imported from spreadsheet') ON CONFLICT (entry_date) DO NOTHING;
INSERT INTO daily_entries (entry_date, total_counted, opening_bhangti, bazar_actual_cost, total_sales, bazar_variance, cash_taken_home, notes)
  VALUES ('2026-08-19', 3405, 0, 270, 3405, 270, 3135, 'Imported from spreadsheet') ON CONFLICT (entry_date) DO NOTHING;
INSERT INTO daily_entries (entry_date, total_counted, opening_bhangti, bazar_actual_cost, total_sales, bazar_variance, cash_taken_home, notes)
  VALUES ('2026-08-20', 4035, 0, 1450, 4035, 1450, 2585, 'Imported from spreadsheet') ON CONFLICT (entry_date) DO NOTHING;
INSERT INTO daily_entries (entry_date, total_counted, opening_bhangti, bazar_actual_cost, total_sales, bazar_variance, cash_taken_home, notes)
  VALUES ('2026-08-21', 3740, 0, 6338, 3740, 6338, -2598, 'Imported from spreadsheet') ON CONFLICT (entry_date) DO NOTHING;
INSERT INTO daily_entries (entry_date, total_counted, opening_bhangti, bazar_actual_cost, total_sales, bazar_variance, cash_taken_home, notes)
  VALUES ('2026-08-22', 2220, 0, 360, 2220, 360, 1860, 'Imported from spreadsheet') ON CONFLICT (entry_date) DO NOTHING;
INSERT INTO daily_entries (entry_date, total_counted, opening_bhangti, bazar_actual_cost, total_sales, bazar_variance, cash_taken_home, notes)
  VALUES ('2026-08-27', 2250, 0, 920, 2250, 920, 1330, 'Imported from spreadsheet') ON CONFLICT (entry_date) DO NOTHING;
INSERT INTO daily_entries (entry_date, total_counted, opening_bhangti, bazar_actual_cost, total_sales, bazar_variance, cash_taken_home, notes)
  VALUES ('2026-08-28', 2890, 0, 390, 2890, 390, 2500, 'Imported from spreadsheet') ON CONFLICT (entry_date) DO NOTHING;
INSERT INTO daily_entries (entry_date, total_counted, opening_bhangti, bazar_actual_cost, total_sales, bazar_variance, cash_taken_home, notes)
  VALUES ('2026-08-29', 2785, 0, 3680, 2785, 3680, -895, 'Imported from spreadsheet') ON CONFLICT (entry_date) DO NOTHING;
INSERT INTO daily_entries (entry_date, total_counted, opening_bhangti, bazar_actual_cost, total_sales, bazar_variance, cash_taken_home, notes)
  VALUES ('2026-08-30', 3380, 0, 1340, 3380, 1340, 2040, 'Imported from spreadsheet') ON CONFLICT (entry_date) DO NOTHING;
INSERT INTO daily_entries (entry_date, total_counted, opening_bhangti, bazar_actual_cost, total_sales, bazar_variance, cash_taken_home, notes)
  VALUES ('2026-08-31', 3200, 0, 1370, 3200, 1370, 1830, 'Imported from spreadsheet') ON CONFLICT (entry_date) DO NOTHING;
INSERT INTO daily_entries (entry_date, total_counted, opening_bhangti, bazar_actual_cost, total_sales, bazar_variance, cash_taken_home, notes)
  VALUES ('2026-09-01', 3240, 0, 2860, 3240, 2860, 380, 'Imported from spreadsheet') ON CONFLICT (entry_date) DO NOTHING;
INSERT INTO daily_entries (entry_date, total_counted, opening_bhangti, bazar_actual_cost, total_sales, bazar_variance, cash_taken_home, notes)
  VALUES ('2026-09-02', 3690, 0, 615, 3690, 615, 3075, 'Imported from spreadsheet') ON CONFLICT (entry_date) DO NOTHING;

-- 19 operating days imported
