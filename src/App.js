import React, { useState, useEffect } from 'react';
import {
  Container,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Box,
  Typography
} from '@mui/material';
import * as XLSX from 'xlsx';

function App() {
  const [data, setData] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [unitFilter, setUnitFilter] = useState('');
  const [filteredData, setFilteredData] = useState(null);

  // Load and unwrap the JSON
  useEffect(() => {
    fetch('/hoglundData1.json')
      .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then(jsonData => {
        const record = Array.isArray(jsonData) ? jsonData[0] : jsonData;
        setData(record);
        setFilteredData(record);
      })
      .catch(error => console.error('Error loading data:', error));
  }, []);

  // Compute list of unique units
  const units = data
    ? Array.from(new Set(Object.values(data).map(entry => entry.UNIT)))
    : [];

  // Filter whenever search term, unit filter, or loaded data changes
  useEffect(() => {
    if (!data) return;

    const searchLower = searchTerm.toLowerCase();
    const filteredEntries = Object.entries(data).filter(([tag, entry]) => {
      const matchesSearch =
        tag.toLowerCase().includes(searchLower) ||
        (entry.DESCR && entry.DESCR.toLowerCase().includes(searchLower));
      const matchesUnit =
        unitFilter === '' || entry.UNIT === unitFilter;
      return matchesSearch && matchesUnit;
    });

    setFilteredData(Object.fromEntries(filteredEntries));
  }, [searchTerm, unitFilter, data]);

  // Compute total number of tags currently displayed
  const totalTags = filteredData ? Object.keys(filteredData).length : 0;

  // Export the currently filtered rows to Excel
  const exportToExcel = () => {
    if (!filteredData) return;

    const excelData = Object.entries(filteredData).map(([tag, entry]) => ({
      Tag: tag,
      Description: entry.DESCR,
      Value: entry.VALUE,
      Status: entry.STATUS,
      Unit: entry.UNIT,
      Created: entry.CREATED?.$date || ''
    }));

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Høglund Data');
    XLSX.writeFile(wb, 'hoglund_data.xlsx');
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Typography variant="h4" gutterBottom>
        Høglund Data Viewer
      </Typography>

      <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center' }}>
        <TextField
          sx={{ flex: 1 }}
          label="Søk i tags eller beskrivelser"
          variant="outlined"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
        <FormControl variant="outlined" sx={{ minWidth: 120 }}>
          <InputLabel>Enhet</InputLabel>
          <Select
            value={unitFilter}
            onChange={e => setUnitFilter(e.target.value)}
            label="Enhet"
          >
            <MenuItem value="">Alle</MenuItem>
            {units.map(unit => (
              <MenuItem key={unit} value={unit}>
                {unit}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Button
          variant="contained"
          onClick={exportToExcel}
          disabled={!filteredData || totalTags === 0}
        >
          Eksporter til Excel
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Tag</TableCell>
              <TableCell>Beskrivelse</TableCell>
              <TableCell>Verdi</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Enhet</TableCell>
              <TableCell>Opprettet</TableCell>
              <TableCell>Totalt tags</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredData &&
              Object.entries(filteredData).map(([tag, entry]) => (
                <TableRow key={tag}>
                  <TableCell>{tag}</TableCell>
                  <TableCell>{entry.DESCR}</TableCell>
                  <TableCell>{entry.VALUE}</TableCell>
                  <TableCell>{entry.STATUS}</TableCell>
                  <TableCell>{entry.UNIT}</TableCell>
                  <TableCell>
                    {entry.CREATED?.$date
                      ? new Date(entry.CREATED.$date).toLocaleString()
                      : ''}
                  </TableCell>
                  <TableCell>{totalTags}</TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Container>
  );
}

export default App;
