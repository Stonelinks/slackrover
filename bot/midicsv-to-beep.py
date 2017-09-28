#!/usr/bin/env python
import argparse
import csv
import codecs
import sys

parser = argparse.ArgumentParser(
    description='Convert midi files to beep tunes')
parser.add_argument(
    '-i', type=str, default='/dev/stdin', help='a filepath to the midi you want played')
parser.add_argument(
    '-o', type=str, default='/dev/stdout', help='the beep output file path')
parser.add_argument(
    '-t', type=float, default=2, help='go fuck yourself')
args = parser.parse_args()
tempo = 120
tempoMultiplier = args.t


def getDuration(row, noteStart):
    return str((int(row[1].strip()) - noteStart) * tempoMultiplier)


def getFreq(row):
    freq = round(midiNumToFreq(int(row[4].strip())), 1)
    if freq == int(freq):
        return str(int(freq))
    return str(freq)


def midiNumToFreq(midiNumber):
    return 440 * pow(2, (midiNumber - 69) / float(12))


def buildBeep():
    with open(args.i, 'rb') as csvFile:
        reader = csv.reader(csvFile)
        beepOut = ''
        noteStart = 0
        for row in reader:
            if 'Note_on_c' in row[2]:
                if 0 == int(row[5].strip()):
                    beepOut += getFreq(row) + ',' + \
                        getDuration(row, noteStart) + '\n'
                else:
                    noteStart = int(row[1].strip())
            elif 'Tempo' in row[2]:
                tempo = int(row[3].strip())
        sys.stdout.write(beepOut)


if not args.i:
    parser.print_help()
else:
    buildBeep()